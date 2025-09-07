import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, securityIssuesTable } from '../db/schema';
import { type UpdateSecurityIssueInput } from '../schema';
import { updateSecurityIssue } from '../handlers/update_security_issue';
import { eq } from 'drizzle-orm';

// Test data setup
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'SecurityAnalyst',
      is_active: true
    })
    .returning()
    .execute();
  return result[0];
};

const createTestContainer = async (userId: number) => {
  const result = await db.insert(containersTable)
    .values({
      name: 'Test Container',
      description: 'Test container for updates',
      type: 'Project',
      created_by: userId
    })
    .returning()
    .execute();
  return result[0];
};

const createTestSecurityIssue = async (containerId: number, userId: number) => {
  const result = await db.insert(securityIssuesTable)
    .values({
      title: 'Original Test Issue',
      description: 'Original description',
      severity: 'Medium',
      classification: 'Vulnerability',
      hierarchy: 'Task',
      confidentiality_impact: 50,
      integrity_impact: 30,
      availability_impact: 20,
      compliance_impact: 10,
      third_party_risk: 5,
      risk_score: 23, // Pre-calculated for testing
      container_id: containerId,
      created_by: userId
    })
    .returning()
    .execute();
  return result[0];
};

describe('updateSecurityIssue', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic issue fields', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      title: 'Updated Issue Title',
      description: 'Updated description',
      severity: 'High',
      status: 'In-progress'
    };

    const result = await updateSecurityIssue(input);

    expect(result.id).toBe(issue.id);
    expect(result.title).toBe('Updated Issue Title');
    expect(result.description).toBe('Updated description');
    expect(result.severity).toBe('High');
    expect(result.status).toBe('In-progress');
    expect(result.updated_at.getTime()).toBeGreaterThan(issue.updated_at.getTime());
  });

  it('should update only provided fields', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      title: 'Only Title Updated'
    };

    const result = await updateSecurityIssue(input);

    expect(result.title).toBe('Only Title Updated');
    expect(result.description).toBe('Original description'); // Should remain unchanged
    expect(result.severity).toBe('Medium'); // Should remain unchanged
    expect(result.classification).toBe('Vulnerability'); // Should remain unchanged
  });

  it('should recalculate risk score when impact dimensions change', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      confidentiality_impact: 80,
      integrity_impact: 70,
      availability_impact: 60
    };

    const result = await updateSecurityIssue(input);

    // Expected calculation: (80 * 0.25) + (70 * 0.25) + (60 * 0.25) + (10 * 0.15) + (5 * 0.1) = 54.5
    expect(result.confidentiality_impact).toBe(80);
    expect(result.integrity_impact).toBe(70);
    expect(result.availability_impact).toBe(60);
    expect(result.compliance_impact).toBe(10); // Unchanged
    expect(result.third_party_risk).toBe(5); // Unchanged
    expect(result.risk_score).toBe(54.5);
    expect(typeof result.risk_score).toBe('number');
  });

  it('should update container risk score when issue risk score changes', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    
    // Create two issues in the same container
    const issue1 = await createTestSecurityIssue(container.id, user.id);
    await db.insert(securityIssuesTable)
      .values({
        title: 'Second Issue',
        description: 'Second test issue',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        confidentiality_impact: 10,
        integrity_impact: 10,
        availability_impact: 10,
        compliance_impact: 10,
        third_party_risk: 10,
        risk_score: 10,
        container_id: container.id,
        created_by: user.id
      })
      .execute();

    // Update first issue to have higher risk
    const input: UpdateSecurityIssueInput = {
      id: issue1.id,
      confidentiality_impact: 100,
      integrity_impact: 100,
      availability_impact: 100,
      compliance_impact: 100,
      third_party_risk: 100
    };

    await updateSecurityIssue(input);

    // Check that container risk score was updated (average of 100 and 10 = 55)
    const updatedContainer = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, container.id))
      .execute();

    expect(updatedContainer[0].risk_score).toBe(55);
    expect(updatedContainer[0].updated_at.getTime()).toBeGreaterThan(container.updated_at.getTime());
  });

  it('should handle partial impact dimension updates correctly', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      confidentiality_impact: 90, // Only update this dimension
      compliance_impact: 40 // And this one
    };

    const result = await updateSecurityIssue(input);

    // Should use new values for updated dimensions and existing values for others
    // Expected: (90 * 0.25) + (30 * 0.25) + (20 * 0.25) + (40 * 0.15) + (5 * 0.1) = 41.5
    expect(result.confidentiality_impact).toBe(90);
    expect(result.integrity_impact).toBe(30); // Unchanged
    expect(result.availability_impact).toBe(20); // Unchanged
    expect(result.compliance_impact).toBe(40);
    expect(result.third_party_risk).toBe(5); // Unchanged
    expect(result.risk_score).toBe(41.5);
  });

  it('should update MITRE and LINDDUN fields', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      mitre_attack_id: 'T1078',
      mitre_attack_tactic: 'Initial Access',
      mitre_attack_technique: 'Valid Accounts',
      linddun_category: 'Denial',
      attack_complexity: 'Low'
    };

    const result = await updateSecurityIssue(input);

    expect(result.mitre_attack_id).toBe('T1078');
    expect(result.mitre_attack_tactic).toBe('Initial Access');
    expect(result.mitre_attack_technique).toBe('Valid Accounts');
    expect(result.linddun_category).toBe('Denial');
    expect(result.attack_complexity).toBe('Low');
  });

  it('should update assignment and notes fields', async () => {
    const user = await createTestUser();
    const assignee = await db.insert(usersTable)
      .values({
        username: 'assignee',
        email: 'assignee@example.com',
        full_name: 'Assignee User',
        role: 'SecurityAnalyst',
        is_active: true
      })
      .returning()
      .execute();
    
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      assigned_to: assignee[0].id,
      threat_modeling_notes: 'Updated threat modeling notes',
      compensating_controls: 'Updated compensating controls'
    };

    const result = await updateSecurityIssue(input);

    expect(result.assigned_to).toBe(assignee[0].id);
    expect(result.threat_modeling_notes).toBe('Updated threat modeling notes');
    expect(result.compensating_controls).toBe('Updated compensating controls');
  });

  it('should handle null values correctly', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      assigned_to: null,
      mitre_attack_id: null,
      threat_modeling_notes: null
    };

    const result = await updateSecurityIssue(input);

    expect(result.assigned_to).toBeNull();
    expect(result.mitre_attack_id).toBeNull();
    expect(result.threat_modeling_notes).toBeNull();
  });

  it('should save changes to database', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    const input: UpdateSecurityIssueInput = {
      id: issue.id,
      title: 'Database Test Update',
      severity: 'Critical',
      confidentiality_impact: 95
    };

    await updateSecurityIssue(input);

    // Verify changes were persisted to database
    const dbIssue = await db.select()
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.id, issue.id))
      .execute();

    expect(dbIssue).toHaveLength(1);
    expect(dbIssue[0].title).toBe('Database Test Update');
    expect(dbIssue[0].severity).toBe('Critical');
    expect(dbIssue[0].confidentiality_impact).toBe(95);
    expect(dbIssue[0].updated_at.getTime()).toBeGreaterThan(issue.updated_at.getTime());
  });

  it('should throw error for non-existent issue', async () => {
    const input: UpdateSecurityIssueInput = {
      id: 99999,
      title: 'This should fail'
    };

    await expect(updateSecurityIssue(input)).rejects.toThrow(/not found/i);
  });

  it('should calculate risk scores with edge values correctly', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    const issue = await createTestSecurityIssue(container.id, user.id);

    // Test with all zeros
    const zeroInput: UpdateSecurityIssueInput = {
      id: issue.id,
      confidentiality_impact: 0,
      integrity_impact: 0,
      availability_impact: 0,
      compliance_impact: 0,
      third_party_risk: 0
    };

    const zeroResult = await updateSecurityIssue(zeroInput);
    expect(zeroResult.risk_score).toBe(0);

    // Test with all maximum values
    const maxInput: UpdateSecurityIssueInput = {
      id: issue.id,
      confidentiality_impact: 100,
      integrity_impact: 100,
      availability_impact: 100,
      compliance_impact: 100,
      third_party_risk: 100
    };

    const maxResult = await updateSecurityIssue(maxInput);
    expect(maxResult.risk_score).toBe(100);
  });
});