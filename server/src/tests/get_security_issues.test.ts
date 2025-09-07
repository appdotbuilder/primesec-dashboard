import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, securityIssuesTable } from '../db/schema';
import { type SecurityIssueFilter } from '../schema';
import { getSecurityIssues, getSecurityIssuesByContainer } from '../handlers/get_security_issues';

// Test data setup
let testUser1: any;
let testUser2: any;
let testContainer1: any;
let testContainer2: any;

const setupTestData = async () => {
  // Create test users
  const users = await db.insert(usersTable)
    .values([
      {
        username: 'testuser1',
        email: 'test1@example.com',
        full_name: 'Test User 1',
        role: 'SecurityAnalyst'
      },
      {
        username: 'testuser2',
        email: 'test2@example.com',
        full_name: 'Test User 2',
        role: 'SecurityManager'
      }
    ])
    .returning()
    .execute();

  testUser1 = users[0];
  testUser2 = users[1];

  // Create test containers
  const containers = await db.insert(containersTable)
    .values([
      {
        name: 'Test Container 1',
        description: 'First test container',
        type: 'Project',
        created_by: testUser1.id
      },
      {
        name: 'Test Container 2',
        description: 'Second test container',
        type: 'Application',
        created_by: testUser2.id
      }
    ])
    .returning()
    .execute();

  testContainer1 = containers[0];
  testContainer2 = containers[1];
};

describe('getSecurityIssues', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });

  afterEach(resetDB);

  it('should return all security issues when no filter is provided', async () => {
    // Create test security issues
    await db.insert(securityIssuesTable)
      .values({
        title: 'Critical SQL Injection',
        description: 'SQL injection vulnerability in login form',
        severity: 'Critical',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        risk_score: 95.5,
        confidentiality_impact: 90,
        integrity_impact: 80,
        availability_impact: 70,
        compliance_impact: 85,
        third_party_risk: 60,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Medium Config Issue',
        description: 'Misconfiguration in web server',
        severity: 'Medium',
        classification: 'Misconfiguration',
        hierarchy: 'Task',
        risk_score: 45.0,
        container_id: testContainer2.id,
        created_by: testUser2.id
      })
      .execute();

    const results = await getSecurityIssues();

    expect(results).toHaveLength(2);
    expect(results[0].title).toEqual('Critical SQL Injection');
    expect(results[0].risk_score).toEqual(95.5);
    expect(typeof results[0].risk_score).toBe('number');
    expect(results[0].confidentiality_impact).toEqual(90);
    expect(results[1].title).toEqual('Medium Config Issue');
    expect(results[1].risk_score).toEqual(45);
  });

  it('should filter by container_id correctly', async () => {
    // Create issues in different containers
    await db.insert(securityIssuesTable)
      .values({
        title: 'Container 1 Issue',
        description: 'Issue in first container',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Container 2 Issue',
        description: 'Issue in second container',
        severity: 'Medium',
        classification: 'Weakness',
        hierarchy: 'Task',
        container_id: testContainer2.id,
        created_by: testUser2.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      container_id: testContainer1.id
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Container 1 Issue');
    expect(results[0].container_id).toEqual(testContainer1.id);
  });

  it('should filter by severity correctly', async () => {
    // Create issues with different severities
    await db.insert(securityIssuesTable)
      .values({
        title: 'Critical Issue',
        description: 'Critical security issue',
        severity: 'Critical',
        classification: 'Vulnerability',
        hierarchy: 'Epic',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'High Issue',
        description: 'High priority issue',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Low Issue',
        description: 'Low priority issue',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      severity: 'Critical'
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Critical Issue');
    expect(results[0].severity).toEqual('Critical');
  });

  it('should filter by status correctly', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'Open Issue',
        description: 'Still open',
        severity: 'High',
        status: 'Open',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Resolved Issue',
        description: 'Already resolved',
        severity: 'High',
        status: 'Resolved',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      status: 'Resolved'
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Resolved Issue');
    expect(results[0].status).toEqual('Resolved');
  });

  it('should filter by risk score range correctly', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'High Risk Issue',
        description: 'High risk score',
        severity: 'Critical',
        classification: 'Vulnerability',
        hierarchy: 'Epic',
        risk_score: 85.5,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Medium Risk Issue',
        description: 'Medium risk score',
        severity: 'Medium',
        classification: 'Misconfiguration',
        hierarchy: 'Story',
        risk_score: 55.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Low Risk Issue',
        description: 'Low risk score',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        risk_score: 25.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      risk_score_min: 50,
      risk_score_max: 90
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(2);
    expect(results[0].title).toEqual('High Risk Issue');
    expect(results[0].risk_score).toEqual(85.5);
    expect(results[1].title).toEqual('Medium Risk Issue');
    expect(results[1].risk_score).toEqual(55);
  });

  it('should filter by date range correctly', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(securityIssuesTable)
      .values({
        title: 'Recent Issue',
        description: 'Created today',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      created_after: yesterday,
      created_before: tomorrow
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Recent Issue');
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].created_at >= yesterday).toBe(true);
    expect(results[0].created_at <= tomorrow).toBe(true);
  });

  it('should apply multiple filters correctly', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'Matching Issue',
        description: 'Matches all filters',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        risk_score: 75.0,
        assigned_to: testUser1.id,
        container_id: testContainer1.id,
        created_by: testUser1.id,
        is_automated_finding: true
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Non-matching Issue',
        description: 'Does not match filters',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        risk_score: 25.0,
        assigned_to: testUser2.id,
        container_id: testContainer2.id,
        created_by: testUser2.id,
        is_automated_finding: false
      })
      .execute();

    const filter: SecurityIssueFilter = {
      container_id: testContainer1.id,
      severity: 'High',
      classification: 'Vulnerability',
      assigned_to: testUser1.id,
      is_automated_finding: true,
      risk_score_min: 70
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Matching Issue');
    expect(results[0].severity).toEqual('High');
    expect(results[0].classification).toEqual('Vulnerability');
    expect(results[0].assigned_to).toEqual(testUser1.id);
    expect(results[0].is_automated_finding).toBe(true);
    expect(results[0].risk_score).toEqual(75);
  });

  it('should return empty array when no issues match filter', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'Test Issue',
        description: 'Test description',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const filter: SecurityIssueFilter = {
      severity: 'Critical'
    };

    const results = await getSecurityIssues(filter);

    expect(results).toHaveLength(0);
  });
});

describe('getSecurityIssuesByContainer', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });

  afterEach(resetDB);

  it('should return issues for specific container', async () => {
    // Create issues in different containers
    await db.insert(securityIssuesTable)
      .values({
        title: 'Container 1 Issue A',
        description: 'First issue in container 1',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Epic',
        risk_score: 90.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Container 1 Issue B',
        description: 'Second issue in container 1',
        severity: 'Medium',
        classification: 'Misconfiguration',
        hierarchy: 'Story',
        risk_score: 60.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Container 2 Issue',
        description: 'Issue in container 2',
        severity: 'Low',
        classification: 'Weakness',
        hierarchy: 'Task',
        container_id: testContainer2.id,
        created_by: testUser2.id
      })
      .execute();

    const results = await getSecurityIssuesByContainer(testContainer1.id);

    expect(results).toHaveLength(2);
    // With hierarchy DESC, Task > Story > Epic in enum order
    // But we order by hierarchy DESC, then risk_score DESC
    // So Story (index 1) comes before Epic (index 0), but Epic has higher risk
    expect(results[0].title).toEqual('Container 1 Issue B');
    expect(results[0].container_id).toEqual(testContainer1.id);
    expect(results[0].hierarchy).toEqual('Story');
    expect(results[0].risk_score).toEqual(60);
    expect(results[1].title).toEqual('Container 1 Issue A');
    expect(results[1].container_id).toEqual(testContainer1.id);
    expect(results[1].hierarchy).toEqual('Epic');
    expect(results[1].risk_score).toEqual(90);
  });

  it('should convert numeric fields correctly', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'Numeric Test Issue',
        description: 'Testing numeric conversions',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        risk_score: 87.5,
        confidentiality_impact: 95.0,
        integrity_impact: 80.5,
        availability_impact: 75.0,
        compliance_impact: 90.0,
        third_party_risk: 65.5,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const results = await getSecurityIssuesByContainer(testContainer1.id);

    expect(results).toHaveLength(1);
    const issue = results[0];
    
    // Verify all numeric fields are properly converted
    expect(typeof issue.risk_score).toBe('number');
    expect(issue.risk_score).toEqual(87.5);
    expect(typeof issue.confidentiality_impact).toBe('number');
    expect(issue.confidentiality_impact).toEqual(95);
    expect(typeof issue.integrity_impact).toBe('number');
    expect(issue.integrity_impact).toEqual(80.5);
    expect(typeof issue.availability_impact).toBe('number');
    expect(issue.availability_impact).toEqual(75);
    expect(typeof issue.compliance_impact).toBe('number');
    expect(issue.compliance_impact).toEqual(90);
    expect(typeof issue.third_party_risk).toBe('number');
    expect(issue.third_party_risk).toEqual(65.5);
  });

  it('should order issues by hierarchy and risk score correctly', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'Task with High Risk',
        description: 'Task level issue',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Task',
        risk_score: 95.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Epic with Medium Risk',
        description: 'Epic level issue',
        severity: 'Medium',
        classification: 'Misconfiguration',
        hierarchy: 'Epic',
        risk_score: 70.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    await db.insert(securityIssuesTable)
      .values({
        title: 'Story with High Risk',
        description: 'Story level issue',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        risk_score: 85.0,
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const results = await getSecurityIssuesByContainer(testContainer1.id);

    expect(results).toHaveLength(3);
    
    // Should be ordered by hierarchy DESC (Task > Story > Epic in enum order), then by risk score DESC
    expect(results[0].title).toEqual('Task with High Risk');
    expect(results[0].hierarchy).toEqual('Task');
    expect(results[0].risk_score).toEqual(95);
    expect(results[1].title).toEqual('Story with High Risk');
    expect(results[1].hierarchy).toEqual('Story');
    expect(results[1].risk_score).toEqual(85);
    expect(results[2].title).toEqual('Epic with Medium Risk');
    expect(results[2].hierarchy).toEqual('Epic');
    expect(results[2].risk_score).toEqual(70);
  });

  it('should include MITRE ATT&CK and LINDDUN mappings', async () => {
    await db.insert(securityIssuesTable)
      .values({
        title: 'MITRE Mapped Issue',
        description: 'Issue with MITRE mappings',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Story',
        mitre_attack_id: 'T1190',
        mitre_attack_tactic: 'Initial Access',
        mitre_attack_technique: 'Exploit Public-Facing Application',
        linddun_category: 'Spoofing',
        container_id: testContainer1.id,
        created_by: testUser1.id
      })
      .execute();

    const results = await getSecurityIssuesByContainer(testContainer1.id);

    expect(results).toHaveLength(1);
    const issue = results[0];
    
    expect(issue.mitre_attack_id).toEqual('T1190');
    expect(issue.mitre_attack_tactic).toEqual('Initial Access');
    expect(issue.mitre_attack_technique).toEqual('Exploit Public-Facing Application');
    expect(issue.linddun_category).toEqual('Spoofing');
  });

  it('should return empty array when container has no issues', async () => {
    const results = await getSecurityIssuesByContainer(testContainer1.id);

    expect(results).toHaveLength(0);
  });

  it('should return empty array for non-existent container', async () => {
    const results = await getSecurityIssuesByContainer(99999);

    expect(results).toHaveLength(0);
  });
});