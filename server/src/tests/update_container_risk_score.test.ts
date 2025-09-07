import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { containersTable, securityIssuesTable, usersTable } from '../db/schema';
import { updateContainerRiskScore } from '../handlers/update_container_risk_score';
import { eq } from 'drizzle-orm';

describe('updateContainerRiskScore', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();
    return result[0].id;
  };

  // Helper function to create a test container
  const createTestContainer = async (userId: number) => {
    const result = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Container for testing',
        type: 'Project',
        created_by: userId
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create a security issue
  const createSecurityIssue = async (containerId: number, userId: number, severity: 'Critical' | 'High' | 'Medium' | 'Low', riskScore: number, status: 'Open' | 'Closed' = 'Open') => {
    const result = await db.insert(securityIssuesTable)
      .values({
        title: `Test Issue - ${severity}`,
        description: 'Test security issue',
        severity: severity,
        status: status,
        classification: 'Vulnerability',
        hierarchy: 'Task',
        risk_score: riskScore, // Risk score is numeric in database
        confidentiality_impact: 0,
        integrity_impact: 0,
        availability_impact: 0,
        compliance_impact: 0,
        third_party_risk: 0,
        container_id: containerId,
        created_by: userId,
        is_automated_finding: false
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should update risk score for container with no issues', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);

    const result = await updateContainerRiskScore(container.id);

    expect(result.id).toEqual(container.id);
    expect(result.risk_score).toEqual(0);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify database was updated
    const updatedContainer = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, container.id))
      .execute();
    
    expect(updatedContainer[0].risk_score).toEqual(0);
  });

  it('should calculate risk score for single critical issue', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create a critical issue with high risk score
    await createSecurityIssue(container.id, userId, 'Critical', 85);

    const result = await updateContainerRiskScore(container.id);

    expect(result.id).toEqual(container.id);
    expect(result.risk_score).toEqual(85); // Single critical issue, weight = 1.0, so score remains 85
    expect(typeof result.risk_score).toBe('number');
  });

  it('should calculate weighted average for multiple issues', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create issues with different severities and risk scores
    await createSecurityIssue(container.id, userId, 'Critical', 90); // weight: 1.0
    await createSecurityIssue(container.id, userId, 'High', 70);     // weight: 0.8
    await createSecurityIssue(container.id, userId, 'Medium', 50);   // weight: 0.6
    await createSecurityIssue(container.id, userId, 'Low', 20);      // weight: 0.3

    const result = await updateContainerRiskScore(container.id);

    // Expected calculation:
    // (90 * 1.0 + 70 * 0.8 + 50 * 0.6 + 20 * 0.3) / (1.0 + 0.8 + 0.6 + 0.3)
    // = (90 + 56 + 30 + 6) / 2.7 = 182 / 2.7 = 67.41
    expect(result.risk_score).toBeCloseTo(67.41, 1);
  });

  it('should only consider open issues for risk calculation', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create open and closed issues
    await createSecurityIssue(container.id, userId, 'Critical', 90, 'Open');
    await createSecurityIssue(container.id, userId, 'Critical', 80, 'Closed'); // Should be ignored
    await createSecurityIssue(container.id, userId, 'High', 60, 'Open');

    const result = await updateContainerRiskScore(container.id);

    // Expected calculation with only open issues:
    // (90 * 1.0 + 60 * 0.8) / (1.0 + 0.8) = (90 + 48) / 1.8 = 138 / 1.8 = 76.67
    expect(result.risk_score).toBeCloseTo(76.67, 1);
  });

  it('should cap risk score at 100', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create multiple critical issues with very high risk scores
    await createSecurityIssue(container.id, userId, 'Critical', 100);
    await createSecurityIssue(container.id, userId, 'Critical', 100);
    await createSecurityIssue(container.id, userId, 'Critical', 100);

    const result = await updateContainerRiskScore(container.id);

    expect(result.risk_score).toEqual(100);
  });

  it('should handle container with mixed severity levels correctly', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create multiple issues of same severity
    await createSecurityIssue(container.id, userId, 'Medium', 40);
    await createSecurityIssue(container.id, userId, 'Medium', 60);
    await createSecurityIssue(container.id, userId, 'Medium', 80);

    const result = await updateContainerRiskScore(container.id);

    // Expected: (40 * 0.6 + 60 * 0.6 + 80 * 0.6) / (0.6 + 0.6 + 0.6)
    // = (24 + 36 + 48) / 1.8 = 108 / 1.8 = 60
    expect(result.risk_score).toEqual(60);
  });

  it('should throw error for non-existent container', async () => {
    await expect(updateContainerRiskScore(999)).rejects.toThrow(/Container with id 999 not found/i);
  });

  it('should persist risk score update in database', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    await createSecurityIssue(container.id, userId, 'High', 75);

    const result = await updateContainerRiskScore(container.id);

    // Verify the database was actually updated
    const dbContainer = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, container.id))
      .execute();

    expect(dbContainer[0].risk_score).toEqual(75);
    expect(dbContainer[0].updated_at).toBeInstanceOf(Date);
    
    // Ensure updated_at was actually changed
    expect(dbContainer[0].updated_at.getTime()).toBeGreaterThan(container.updated_at.getTime());
  });

  it('should handle edge case with zero risk score issues', async () => {
    const userId = await createTestUser();
    const container = await createTestContainer(userId);
    
    // Create issues with zero risk scores
    await createSecurityIssue(container.id, userId, 'Low', 0);
    await createSecurityIssue(container.id, userId, 'Medium', 0);

    const result = await updateContainerRiskScore(container.id);

    expect(result.risk_score).toEqual(0);
  });
});