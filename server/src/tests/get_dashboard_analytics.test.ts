import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  containersTable, 
  securityIssuesTable, 
  securityViolationsTable,
  securityControlsTable 
} from '../db/schema';
import { getDashboardAnalytics, getContainerRiskAnalytics } from '../handlers/get_dashboard_analytics';

describe('getDashboardAnalytics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty analytics when no data exists', async () => {
    const result = await getDashboardAnalytics();

    expect(result.total_issues).toBe(0);
    expect(result.critical_issues).toBe(0);
    expect(result.high_issues).toBe(0);
    expect(result.medium_issues).toBe(0);
    expect(result.low_issues).toBe(0);
    expect(result.open_issues).toBe(0);
    expect(result.resolved_issues).toBe(0);
    expect(result.average_risk_score).toBe(0);
    expect(result.top_risk_containers).toHaveLength(0);
    expect(result.recent_violations).toHaveLength(0);
    expect(result.control_coverage.existing).toBe(0);
    expect(result.control_coverage.planned).toBe(0);
    expect(result.control_coverage.not_specified).toBe(0);
  });

  it('should calculate comprehensive analytics with mixed data', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test containers
    const containerResults = await db.insert(containersTable)
      .values([
        {
          name: 'High Risk Container',
          description: 'Container with high-risk issues',
          type: 'Application',
          created_by: userId
        },
        {
          name: 'Low Risk Container',
          description: 'Container with low-risk issues',
          type: 'Project',
          created_by: userId
        }
      ])
      .returning()
      .execute();

    const highRiskContainerId = containerResults[0].id;
    const lowRiskContainerId = containerResults[1].id;

    // Create security issues with different severities and risk scores
    await db.insert(securityIssuesTable)
      .values([
        // High risk container issues
        {
          title: 'Critical Security Issue',
          description: 'A critical security vulnerability',
          severity: 'Critical',
          status: 'Open',
          classification: 'Vulnerability',
          hierarchy: 'Epic',
          risk_score: 95.0,
          container_id: highRiskContainerId,
          created_by: userId
        },
        {
          title: 'High Priority Issue',
          description: 'A high priority security issue',
          severity: 'High',
          status: 'In-progress',
          classification: 'Misconfiguration',
          hierarchy: 'Story',
          risk_score: 80.0,
          container_id: highRiskContainerId,
          created_by: userId
        },
        // Low risk container issues
        {
          title: 'Medium Priority Issue',
          description: 'A medium priority issue',
          severity: 'Medium',
          status: 'Resolved',
          classification: 'Weakness',
          hierarchy: 'Task',
          risk_score: 50.0,
          container_id: lowRiskContainerId,
          created_by: userId
        },
        {
          title: 'Low Priority Issue',
          description: 'A low priority issue',
          severity: 'Low',
          status: 'Closed',
          classification: 'Exposure',
          hierarchy: 'Task',
          risk_score: 20.0,
          container_id: lowRiskContainerId,
          created_by: userId
        }
      ])
      .execute();

    // Create recent violations
    await db.insert(securityViolationsTable)
      .values([
        {
          title: 'Recent Security Breach',
          description: 'A recent security violation',
          violation_type: 'SecurityBreach',
          severity: 'Critical',
          status: 'Open',
          incident_date: new Date(),
          container_id: highRiskContainerId,
          created_by: userId
        },
        {
          title: 'Policy Violation',
          description: 'A policy violation from last week',
          violation_type: 'PolicyViolation',
          severity: 'High',
          status: 'In-progress',
          incident_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          container_id: lowRiskContainerId,
          created_by: userId
        }
      ])
      .execute();

    // Create security controls with different statuses
    await db.insert(securityControlsTable)
      .values([
        {
          name: 'Existing Control',
          description: 'An existing security control',
          control_type: 'Preventive',
          implementation_status: 'Existing',
          container_id: highRiskContainerId,
          created_by: userId
        },
        {
          name: 'Planned Control',
          description: 'A planned security control',
          control_type: 'Detective',
          implementation_status: 'Planned',
          container_id: lowRiskContainerId,
          created_by: userId
        },
        {
          name: 'Unspecified Control',
          description: 'A control with unspecified status',
          control_type: 'Corrective',
          implementation_status: 'NotSpecified',
          container_id: highRiskContainerId,
          created_by: userId
        }
      ])
      .execute();

    const result = await getDashboardAnalytics();

    // Verify issue counts
    expect(result.total_issues).toBe(4);
    expect(result.critical_issues).toBe(1);
    expect(result.high_issues).toBe(1);
    expect(result.medium_issues).toBe(1);
    expect(result.low_issues).toBe(1);

    // Verify status counts
    expect(result.open_issues).toBe(2); // Open + In-progress
    expect(result.resolved_issues).toBe(2); // Resolved + Closed

    // Verify average risk score calculation
    // (95 + 80 + 50 + 20) / 4 = 61.25
    expect(result.average_risk_score).toBeCloseTo(61.25, 2);

    // Verify top risk containers
    expect(result.top_risk_containers).toHaveLength(2);
    expect(result.top_risk_containers[0].container_name).toBe('High Risk Container');
    expect(result.top_risk_containers[0].risk_score).toBeCloseTo(87.5, 1); // (95 + 80) / 2
    expect(result.top_risk_containers[0].issue_count).toBe(2);
    
    expect(result.top_risk_containers[1].container_name).toBe('Low Risk Container');
    expect(result.top_risk_containers[1].risk_score).toBeCloseTo(35.0, 1); // (50 + 20) / 2
    expect(result.top_risk_containers[1].issue_count).toBe(2);

    // Verify recent violations
    expect(result.recent_violations).toHaveLength(2);
    expect(result.recent_violations[0].title).toBe('Recent Security Breach');
    expect(result.recent_violations[0].severity).toBe('Critical');

    // Verify control coverage
    expect(result.control_coverage.existing).toBe(1);
    expect(result.control_coverage.planned).toBe(1);
    expect(result.control_coverage.not_specified).toBe(1);
  });

  it('should handle old violations correctly (not include in recent)', async () => {
    // Create test user and container
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Test container',
        type: 'Application',
        created_by: userId
      })
      .returning()
      .execute();

    const containerId = containerResult[0].id;

    // Create old violation (35 days ago)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);

    await db.insert(securityViolationsTable)
      .values({
        title: 'Old Violation',
        description: 'An old security violation',
        violation_type: 'SecurityBreach',
        severity: 'High',
        status: 'Closed',
        incident_date: oldDate,
        container_id: containerId,
        created_by: userId
      })
      .execute();

    const result = await getDashboardAnalytics();

    // Should not include old violations in recent violations
    expect(result.recent_violations).toHaveLength(0);
  });

  it('should handle inactive controls correctly', async () => {
    // Create test user and container
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Test container',
        type: 'Application',
        created_by: userId
      })
      .returning()
      .execute();

    const containerId = containerResult[0].id;

    // Create active and inactive controls
    await db.insert(securityControlsTable)
      .values([
        {
          name: 'Active Control',
          description: 'An active control',
          control_type: 'Preventive',
          implementation_status: 'Existing',
          is_active: true,
          container_id: containerId,
          created_by: userId
        },
        {
          name: 'Inactive Control',
          description: 'An inactive control',
          control_type: 'Detective',
          implementation_status: 'Existing',
          is_active: false,
          container_id: containerId,
          created_by: userId
        }
      ])
      .execute();

    const result = await getDashboardAnalytics();

    // Should only count active controls
    expect(result.control_coverage.existing).toBe(1);
  });
});

describe('getContainerRiskAnalytics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty analytics for non-existent container', async () => {
    const result = await getContainerRiskAnalytics(999);

    expect(result.container_risk_score).toBe(0);
    expect(result.issue_breakdown).toEqual({});
    expect(result.risk_trends).toHaveLength(0);
    expect(result.top_issues).toHaveLength(0);
  });

  it('should calculate container-specific analytics', async () => {
    // Create test user and container
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Test container for analytics',
        type: 'Application',
        created_by: userId
      })
      .returning()
      .execute();

    const containerId = containerResult[0].id;

    // Create different containers for isolation
    const otherContainerResult = await db.insert(containersTable)
      .values({
        name: 'Other Container',
        description: 'Other container',
        type: 'Project',
        created_by: userId
      })
      .returning()
      .execute();

    const otherContainerId = otherContainerResult[0].id;

    // Create issues in the target container
    await db.insert(securityIssuesTable)
      .values([
        {
          title: 'Critical Issue',
          description: 'A critical issue',
          severity: 'Critical',
          status: 'Open',
          classification: 'Vulnerability',
          hierarchy: 'Epic',
          risk_score: 90.0,
          container_id: containerId,
          created_by: userId
        },
        {
          title: 'High Issue',
          description: 'A high priority issue',
          severity: 'High',
          status: 'Open',
          classification: 'Misconfiguration',
          hierarchy: 'Story',
          risk_score: 75.0,
          container_id: containerId,
          created_by: userId
        },
        {
          title: 'Medium Issue',
          description: 'A medium priority issue',
          severity: 'Medium',
          status: 'Resolved',
          classification: 'Weakness',
          hierarchy: 'Task',
          risk_score: 40.0,
          container_id: containerId,
          created_by: userId
        }
      ])
      .execute();

    // Create issues in other container (should not affect results)
    await db.insert(securityIssuesTable)
      .values({
        title: 'Other Container Issue',
        description: 'Issue in different container',
        severity: 'Critical',
        status: 'Open',
        classification: 'Vulnerability',
        hierarchy: 'Epic',
        risk_score: 100.0,
        container_id: otherContainerId,
        created_by: userId
      })
      .execute();

    const result = await getContainerRiskAnalytics(containerId);

    // Verify container risk score calculation
    // (90 + 75 + 40) / 3 = 68.33
    expect(result.container_risk_score).toBeCloseTo(68.33, 2);

    // Verify issue breakdown by severity
    expect(result.issue_breakdown).toEqual({
      'Critical': 1,
      'High': 1,
      'Medium': 1
    });

    // Verify top issues are sorted by risk score
    expect(result.top_issues).toHaveLength(3);
    expect(result.top_issues[0].title).toBe('Critical Issue');
    expect(result.top_issues[0].risk_score).toBe(90.0);
    expect(result.top_issues[1].title).toBe('High Issue');
    expect(result.top_issues[1].risk_score).toBe(75.0);
    expect(result.top_issues[2].title).toBe('Medium Issue');
    expect(result.top_issues[2].risk_score).toBe(40.0);
  });

  it('should limit top issues to 10 results', async () => {
    // Create test user and container
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin',
        is_active: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'Test container',
        type: 'Application',
        created_by: userId
      })
      .returning()
      .execute();

    const containerId = containerResult[0].id;

    // Create 15 issues to test the limit
    const issues = [];
    for (let i = 1; i <= 15; i++) {
      issues.push({
        title: `Issue ${i}`,
        description: `Test issue ${i}`,
        severity: 'Medium' as const,
        status: 'Open' as const,
        classification: 'Weakness' as const,
        hierarchy: 'Task' as const,
        risk_score: i * 5.0, // Risk scores from 5 to 75
        container_id: containerId,
        created_by: userId
      });
    }

    await db.insert(securityIssuesTable)
      .values(issues)
      .execute();

    const result = await getContainerRiskAnalytics(containerId);

    // Should only return top 10 issues
    expect(result.top_issues).toHaveLength(10);
    
    // Should be sorted by highest risk score first
    expect(result.top_issues[0].title).toBe('Issue 15');
    expect(result.top_issues[0].risk_score).toBe(75.0);
    expect(result.top_issues[9].title).toBe('Issue 6');
    expect(result.top_issues[9].risk_score).toBe(30.0);
  });
});