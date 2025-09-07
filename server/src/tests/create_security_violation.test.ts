import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  securityViolationsTable, 
  usersTable, 
  containersTable, 
  securityIssuesTable 
} from '../db/schema';
import { type CreateSecurityViolationInput } from '../schema';
import { createSecurityViolation } from '../handlers/create_security_violation';
import { eq } from 'drizzle-orm';

// Test data setup
let testUserId: number;
let testContainerId: number;
let testIssueId: number;
let assignedUserId: number;

describe('createSecurityViolation', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testcreator',
          email: 'creator@test.com',
          full_name: 'Test Creator',
          role: 'SecurityAnalyst'
        },
        {
          username: 'testassignee',
          email: 'assignee@test.com',
          full_name: 'Test Assignee',
          role: 'SecurityAnalyst'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    assignedUserId = users[1].id;

    // Create test container
    const containers = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Container for testing',
        type: 'Application',
        created_by: testUserId
      })
      .returning()
      .execute();

    testContainerId = containers[0].id;

    // Create test security issue
    const issues = await db.insert(securityIssuesTable)
      .values({
        title: 'Test Security Issue',
        description: 'Issue for testing violations',
        severity: 'High',
        classification: 'Vulnerability',
        hierarchy: 'Task',
        container_id: testContainerId,
        created_by: testUserId
      })
      .returning()
      .execute();

    testIssueId = issues[0].id;
  });

  afterEach(resetDB);

  it('should create a security violation with all fields', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Critical Security Breach',
      description: 'Unauthorized access detected in production system',
      violation_type: 'SecurityBreach',
      severity: 'Critical',
      incident_date: new Date('2024-01-15'),
      detection_method: 'Automated monitoring',
      affected_systems: 'Production API, User database',
      impact_assessment: 'High impact - potential data exposure',
      remediation_steps: 'Immediate access revocation, patch deployment',
      container_id: testContainerId,
      related_issue_id: testIssueId,
      assigned_to: assignedUserId,
      created_by: testUserId
    };

    const result = await createSecurityViolation(testInput);

    // Basic field validation
    expect(result.title).toEqual('Critical Security Breach');
    expect(result.description).toEqual(testInput.description);
    expect(result.violation_type).toEqual('SecurityBreach');
    expect(result.severity).toEqual('Critical');
    expect(result.status).toEqual('Open'); // Default status
    expect(result.incident_date).toEqual(new Date('2024-01-15'));
    expect(result.detection_method).toEqual('Automated monitoring');
    expect(result.affected_systems).toEqual('Production API, User database');
    expect(result.impact_assessment).toEqual('High impact - potential data exposure');
    expect(result.remediation_steps).toEqual('Immediate access revocation, patch deployment');
    expect(result.container_id).toEqual(testContainerId);
    expect(result.related_issue_id).toEqual(testIssueId);
    expect(result.assigned_to).toEqual(assignedUserId);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a security violation with minimal required fields', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Policy Violation',
      description: 'User accessed restricted area without authorization',
      violation_type: 'PolicyViolation',
      severity: 'Medium',
      incident_date: new Date('2024-01-16'),
      detection_method: null,
      affected_systems: null,
      impact_assessment: null,
      remediation_steps: null,
      container_id: null,
      related_issue_id: null,
      assigned_to: null,
      created_by: testUserId
    };

    const result = await createSecurityViolation(testInput);

    expect(result.title).toEqual('Policy Violation');
    expect(result.description).toEqual(testInput.description);
    expect(result.violation_type).toEqual('PolicyViolation');
    expect(result.severity).toEqual('Medium');
    expect(result.status).toEqual('Open');
    expect(result.incident_date).toEqual(new Date('2024-01-16'));
    expect(result.detection_method).toBeNull();
    expect(result.affected_systems).toBeNull();
    expect(result.impact_assessment).toBeNull();
    expect(result.remediation_steps).toBeNull();
    expect(result.container_id).toBeNull();
    expect(result.related_issue_id).toBeNull();
    expect(result.assigned_to).toBeNull();
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
  });

  it('should save security violation to database', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Compliance Issue',
      description: 'System configuration violates GDPR requirements',
      violation_type: 'ComplianceIssue',
      severity: 'High',
      incident_date: new Date('2024-01-17'),
      detection_method: 'Audit review',
      affected_systems: 'Customer data processing system',
      impact_assessment: 'Potential regulatory penalties',
      remediation_steps: 'Update privacy controls, notify DPO',
      container_id: testContainerId,
      related_issue_id: testIssueId,
      assigned_to: assignedUserId,
      created_by: testUserId
    };

    const result = await createSecurityViolation(testInput);

    // Query database directly to verify save
    const violations = await db.select()
      .from(securityViolationsTable)
      .where(eq(securityViolationsTable.id, result.id))
      .execute();

    expect(violations).toHaveLength(1);
    expect(violations[0].title).toEqual('Compliance Issue');
    expect(violations[0].description).toEqual(testInput.description);
    expect(violations[0].violation_type).toEqual('ComplianceIssue');
    expect(violations[0].severity).toEqual('High');
    expect(violations[0].status).toEqual('Open');
    expect(violations[0].incident_date).toEqual(new Date('2024-01-17'));
    expect(violations[0].container_id).toEqual(testContainerId);
    expect(violations[0].related_issue_id).toEqual(testIssueId);
    expect(violations[0].assigned_to).toEqual(assignedUserId);
    expect(violations[0].created_by).toEqual(testUserId);
    expect(violations[0].created_at).toBeInstanceOf(Date);
    expect(violations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when created_by user does not exist', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Test Violation',
      description: 'Test violation description',
      violation_type: 'DataLeak',
      severity: 'Low',
      incident_date: new Date('2024-01-18'),
      detection_method: null,
      affected_systems: null,
      impact_assessment: null,
      remediation_steps: null,
      container_id: null,
      related_issue_id: null,
      assigned_to: null,
      created_by: 99999 // Non-existent user ID
    };

    await expect(createSecurityViolation(testInput)).rejects.toThrow(/User with ID 99999 does not exist/i);
  });

  it('should throw error when container_id does not exist', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Test Violation',
      description: 'Test violation description',
      violation_type: 'DataLeak',
      severity: 'Low',
      incident_date: new Date('2024-01-18'),
      detection_method: null,
      affected_systems: null,
      impact_assessment: null,
      remediation_steps: null,
      container_id: 99999, // Non-existent container ID
      related_issue_id: null,
      assigned_to: null,
      created_by: testUserId
    };

    await expect(createSecurityViolation(testInput)).rejects.toThrow(/Container with ID 99999 does not exist/i);
  });

  it('should throw error when related_issue_id does not exist', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Test Violation',
      description: 'Test violation description',
      violation_type: 'DataLeak',
      severity: 'Low',
      incident_date: new Date('2024-01-18'),
      detection_method: null,
      affected_systems: null,
      impact_assessment: null,
      remediation_steps: null,
      container_id: testContainerId,
      related_issue_id: 99999, // Non-existent issue ID
      assigned_to: null,
      created_by: testUserId
    };

    await expect(createSecurityViolation(testInput)).rejects.toThrow(/Security issue with ID 99999 does not exist/i);
  });

  it('should throw error when assigned_to user does not exist', async () => {
    const testInput: CreateSecurityViolationInput = {
      title: 'Test Violation',
      description: 'Test violation description',
      violation_type: 'DataLeak',
      severity: 'Low',
      incident_date: new Date('2024-01-18'),
      detection_method: null,
      affected_systems: null,
      impact_assessment: null,
      remediation_steps: null,
      container_id: testContainerId,
      related_issue_id: testIssueId,
      assigned_to: 99999, // Non-existent user ID
      created_by: testUserId
    };

    await expect(createSecurityViolation(testInput)).rejects.toThrow(/Assigned user with ID 99999 does not exist/i);
  });

  it('should handle different violation types and severities', async () => {
    const testInputs: CreateSecurityViolationInput[] = [
      {
        title: 'Data Leak Incident',
        description: 'Sensitive data exposed through misconfigured API',
        violation_type: 'DataLeak',
        severity: 'Critical',
        incident_date: new Date('2024-01-19'),
        detection_method: 'External security researcher report',
        affected_systems: 'Customer API',
        impact_assessment: 'Customer PII potentially exposed',
        remediation_steps: 'API secured, affected customers notified',
        container_id: testContainerId,
        related_issue_id: null,
        assigned_to: assignedUserId,
        created_by: testUserId
      },
      {
        title: 'Policy Violation - Low Severity',
        description: 'Employee used weak password despite policy',
        violation_type: 'PolicyViolation',
        severity: 'Low',
        incident_date: new Date('2024-01-20'),
        detection_method: 'Password audit',
        affected_systems: 'Internal systems',
        impact_assessment: 'Low risk - internal only',
        remediation_steps: 'Password reset required, user training',
        container_id: null,
        related_issue_id: null,
        assigned_to: null,
        created_by: testUserId
      }
    ];

    for (const input of testInputs) {
      const result = await createSecurityViolation(input);
      
      expect(result.title).toEqual(input.title);
      expect(result.violation_type).toEqual(input.violation_type);
      expect(result.severity).toEqual(input.severity);
      expect(result.status).toEqual('Open');
      expect(result.created_by).toEqual(testUserId);
      expect(result.id).toBeDefined();
    }
  });
});