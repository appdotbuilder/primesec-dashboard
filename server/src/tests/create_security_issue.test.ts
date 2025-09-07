import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { securityIssuesTable, containersTable, usersTable } from '../db/schema';
import { type CreateSecurityIssueInput } from '../schema';
import { createSecurityIssue } from '../handlers/create_security_issue';
import { eq } from 'drizzle-orm';

// Test data setup
let testUserId: number;
let testContainerId: number;

const baseTestInput: CreateSecurityIssueInput = {
  title: 'Critical SQL Injection Vulnerability',
  description: 'Application vulnerable to SQL injection attacks in login form',
  severity: 'Critical',
  classification: 'Vulnerability',
  hierarchy: 'Task',
  confidentiality_impact: 90,
  integrity_impact: 85,
  availability_impact: 70,
  compliance_impact: 80,
  third_party_risk: 40,
  mitre_attack_id: 'T1190',
  mitre_attack_tactic: 'Initial Access',
  mitre_attack_technique: 'Exploit Public-Facing Application',
  linddun_category: 'Tampering',
  attack_complexity: 'Low',
  threat_modeling_notes: 'User input not properly sanitized',
  compensating_controls: 'Web Application Firewall in place',
  container_id: 0, // Will be set in beforeEach
  parent_issue_id: null,
  assigned_to: null,
  created_by: 0, // Will be set in beforeEach
  is_automated_finding: false
};

describe('createSecurityIssue', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'SecurityAnalyst'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;

    // Create test container
    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Application',
        description: 'Application for testing',
        type: 'Application',
        created_by: testUserId
      })
      .returning()
      .execute();

    testContainerId = containerResult[0].id;

    // Update test input with actual IDs
    baseTestInput.container_id = testContainerId;
    baseTestInput.created_by = testUserId;
  });

  afterEach(resetDB);

  it('should create a security issue with calculated risk score', async () => {
    const result = await createSecurityIssue(baseTestInput);

    // Basic field validation
    expect(result.title).toEqual('Critical SQL Injection Vulnerability');
    expect(result.description).toEqual(baseTestInput.description);
    expect(result.severity).toEqual('Critical');
    expect(result.status).toEqual('Open'); // Default status
    expect(result.classification).toEqual('Vulnerability');
    expect(result.hierarchy).toEqual('Task');
    expect(result.container_id).toEqual(testContainerId);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify numeric fields are properly converted back to numbers
    expect(typeof result.risk_score).toBe('number');
    expect(typeof result.confidentiality_impact).toBe('number');
    expect(typeof result.integrity_impact).toBe('number');
    expect(typeof result.availability_impact).toBe('number');
    expect(typeof result.compliance_impact).toBe('number');
    expect(typeof result.third_party_risk).toBe('number');

    // Verify impact values
    expect(result.confidentiality_impact).toEqual(90);
    expect(result.integrity_impact).toEqual(85);
    expect(result.availability_impact).toEqual(70);
    expect(result.compliance_impact).toEqual(80);
    expect(result.third_party_risk).toEqual(40);

    // Verify calculated risk score (weighted average should be around 74)
    expect(result.risk_score).toBeGreaterThan(70);
    expect(result.risk_score).toBeLessThan(80);

    // Verify MITRE ATT&CK fields
    expect(result.mitre_attack_id).toEqual('T1190');
    expect(result.mitre_attack_tactic).toEqual('Initial Access');
    expect(result.mitre_attack_technique).toEqual('Exploit Public-Facing Application');
  });

  it('should save security issue to database', async () => {
    const result = await createSecurityIssue(baseTestInput);

    // Query database directly
    const issues = await db.select()
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.id, result.id))
      .execute();

    expect(issues).toHaveLength(1);
    const savedIssue = issues[0];

    expect(savedIssue.title).toEqual('Critical SQL Injection Vulnerability');
    expect(savedIssue.severity).toEqual('Critical');
    expect(savedIssue.classification).toEqual('Vulnerability');
    expect(savedIssue.container_id).toEqual(testContainerId);
    expect(savedIssue.risk_score).toBeGreaterThan(0);
    expect(savedIssue.created_at).toBeInstanceOf(Date);
  });

  it('should update container risk score based on issue average', async () => {
    // Create first security issue
    await createSecurityIssue(baseTestInput);

    // Create second issue with different risk profile
    const secondIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      title: 'Medium Configuration Issue',
      severity: 'Medium',
      confidentiality_impact: 40,
      integrity_impact: 30,
      availability_impact: 20,
      compliance_impact: 50,
      third_party_risk: 10
    };

    await createSecurityIssue(secondIssue);

    // Check updated container risk score
    const containers = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, testContainerId))
      .execute();

    expect(containers).toHaveLength(1);
    const container = containers[0];
    
    // Container risk should be average of both issues
    const containerRisk = container.risk_score;
    expect(containerRisk).toBeGreaterThan(0);
    expect(containerRisk).toBeLessThan(100);
    expect(container.updated_at).toBeInstanceOf(Date);
  });

  it('should handle parent-child issue hierarchy', async () => {
    // Create parent epic issue
    const parentIssue = await createSecurityIssue({
      ...baseTestInput,
      title: 'Security Epic - Web Application Vulnerabilities',
      hierarchy: 'Epic',
      severity: 'High'
    });

    // Create child task
    const childIssue = await createSecurityIssue({
      ...baseTestInput,
      title: 'Child Task - Fix SQL Injection',
      hierarchy: 'Task',
      parent_issue_id: parentIssue.id
    });

    expect(childIssue.parent_issue_id).toEqual(parentIssue.id);

    // Verify in database
    const savedChild = await db.select()
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.id, childIssue.id))
      .execute();

    expect(savedChild[0].parent_issue_id).toEqual(parentIssue.id);
  });

  it('should handle automated findings flag', async () => {
    const automatedIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      title: 'Automated Scan Finding',
      is_automated_finding: true
    };

    const result = await createSecurityIssue(automatedIssue);
    expect(result.is_automated_finding).toBe(true);
  });

  it('should handle nullable fields correctly', async () => {
    const minimalIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      mitre_attack_id: null,
      mitre_attack_tactic: null,
      mitre_attack_technique: null,
      linddun_category: null,
      attack_complexity: null,
      threat_modeling_notes: null,
      compensating_controls: null,
      parent_issue_id: null,
      assigned_to: null
    };

    const result = await createSecurityIssue(minimalIssue);

    expect(result.mitre_attack_id).toBeNull();
    expect(result.mitre_attack_tactic).toBeNull();
    expect(result.mitre_attack_technique).toBeNull();
    expect(result.linddun_category).toBeNull();
    expect(result.attack_complexity).toBeNull();
    expect(result.threat_modeling_notes).toBeNull();
    expect(result.compensating_controls).toBeNull();
    expect(result.parent_issue_id).toBeNull();
    expect(result.assigned_to).toBeNull();
  });

  it('should calculate risk score correctly with zero impacts', async () => {
    const zeroImpactIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      title: 'Low Impact Issue',
      confidentiality_impact: 0,
      integrity_impact: 0,
      availability_impact: 0,
      compliance_impact: 0,
      third_party_risk: 0
    };

    const result = await createSecurityIssue(zeroImpactIssue);
    expect(result.risk_score).toEqual(0);
  });

  it('should calculate risk score correctly with maximum impacts', async () => {
    const maxImpactIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      title: 'Maximum Impact Issue',
      confidentiality_impact: 100,
      integrity_impact: 100,
      availability_impact: 100,
      compliance_impact: 100,
      third_party_risk: 100
    };

    const result = await createSecurityIssue(maxImpactIssue);
    expect(result.risk_score).toEqual(100);
  });

  it('should handle assigned user correctly', async () => {
    // Create another user for assignment
    const assigneeResult = await db.insert(usersTable)
      .values({
        username: 'assignee',
        email: 'assignee@example.com',
        full_name: 'Assignee User',
        role: 'SecurityAnalyst'
      })
      .returning()
      .execute();

    const assigneeId = assigneeResult[0].id;

    const assignedIssue: CreateSecurityIssueInput = {
      ...baseTestInput,
      assigned_to: assigneeId
    };

    const result = await createSecurityIssue(assignedIssue);
    expect(result.assigned_to).toEqual(assigneeId);
  });
});