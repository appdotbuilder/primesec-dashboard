import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { securityViolationsTable, usersTable, containersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  getSecurityViolations, 
  getActiveSecurityViolations, 
  getSecurityViolationsWithDetails,
  type GetSecurityViolationsInput 
} from '../handlers/get_security_violations';

describe('getSecurityViolations', () => {
  let testUserId: number;
  let testContainerId: number;
  let testViolationId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'SecurityAnalyst',
        is_active: true
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test container
    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'A container for testing',
        type: 'Application',
        created_by: testUserId
      })
      .returning()
      .execute();
    testContainerId = containerResult[0].id;

    // Create test security violation
    const violationResult = await db.insert(securityViolationsTable)
      .values({
        title: 'Test Security Breach',
        description: 'A security breach for testing',
        violation_type: 'SecurityBreach',
        severity: 'High',
        status: 'Open',
        incident_date: new Date('2024-01-15'),
        detection_method: 'Automated monitoring',
        affected_systems: 'Web application, Database',
        impact_assessment: 'High impact on data confidentiality',
        remediation_steps: 'Patch vulnerable components',
        container_id: testContainerId,
        assigned_to: testUserId,
        created_by: testUserId
      })
      .returning()
      .execute();
    testViolationId = violationResult[0].id;
  });

  afterEach(resetDB);

  describe('getSecurityViolations', () => {
    it('should fetch all security violations with default parameters', async () => {
      const result = await getSecurityViolations();

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Test Security Breach');
      expect(result[0].violation_type).toEqual('SecurityBreach');
      expect(result[0].severity).toEqual('High');
      expect(result[0].status).toEqual('Open');
      expect(result[0].container_id).toEqual(testContainerId);
      expect(result[0].assigned_to).toEqual(testUserId);
      expect(result[0].id).toBeDefined();
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].incident_date).toBeInstanceOf(Date);
    });

    it('should filter violations by violation_type', async () => {
      // Create additional violations with different types
      await db.insert(securityViolationsTable)
        .values({
          title: 'Policy Violation',
          description: 'Policy violation test',
          violation_type: 'PolicyViolation',
          severity: 'Medium',
          status: 'Open',
          incident_date: new Date('2024-01-16'),
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        violation_type: 'PolicyViolation'
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].violation_type).toEqual('PolicyViolation');
      expect(result[0].title).toEqual('Policy Violation');
    });

    it('should filter violations by severity', async () => {
      // Create additional violation with different severity
      await db.insert(securityViolationsTable)
        .values({
          title: 'Low Priority Issue',
          description: 'Low severity test',
          violation_type: 'ComplianceIssue',
          severity: 'Low',
          status: 'Open',
          incident_date: new Date('2024-01-16'),
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        severity: 'High'
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toEqual('High');
      expect(result[0].title).toEqual('Test Security Breach');
    });

    it('should filter violations by status', async () => {
      // Create resolved violation
      await db.insert(securityViolationsTable)
        .values({
          title: 'Resolved Issue',
          description: 'Resolved test',
          violation_type: 'DataLeak',
          severity: 'Medium',
          status: 'Resolved',
          incident_date: new Date('2024-01-10'),
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        status: 'Open'
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].status).toEqual('Open');
      expect(result[0].title).toEqual('Test Security Breach');
    });

    it('should filter violations by assigned_to', async () => {
      // Create another user and violation
      const anotherUser = await db.insert(usersTable)
        .values({
          username: 'anotheruser',
          email: 'another@example.com',
          full_name: 'Another User',
          role: 'SecurityManager',
          is_active: true
        })
        .returning()
        .execute();

      await db.insert(securityViolationsTable)
        .values({
          title: 'Another Violation',
          description: 'Another test',
          violation_type: 'PolicyViolation',
          severity: 'Medium',
          status: 'Open',
          incident_date: new Date('2024-01-16'),
          assigned_to: anotherUser[0].id,
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        assigned_to: testUserId
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].assigned_to).toEqual(testUserId);
      expect(result[0].title).toEqual('Test Security Breach');
    });

    it('should filter violations by container_id', async () => {
      // Create another container and violation
      const anotherContainer = await db.insert(containersTable)
        .values({
          name: 'Another Container',
          description: 'Another container for testing',
          type: 'System',
          created_by: testUserId
        })
        .returning()
        .execute();

      await db.insert(securityViolationsTable)
        .values({
          title: 'Another Container Issue',
          description: 'Issue in another container',
          violation_type: 'ComplianceIssue',
          severity: 'Medium',
          status: 'Open',
          incident_date: new Date('2024-01-16'),
          container_id: anotherContainer[0].id,
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        container_id: testContainerId
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].container_id).toEqual(testContainerId);
      expect(result[0].title).toEqual('Test Security Breach');
    });

    it('should filter violations by date range', async () => {
      // Create violations on different dates
      await db.insert(securityViolationsTable)
        .values({
          title: 'Old Violation',
          description: 'Old violation test',
          violation_type: 'PolicyViolation',
          severity: 'Low',
          status: 'Closed',
          incident_date: new Date('2024-01-01'),
          created_by: testUserId
        })
        .execute();

      await db.insert(securityViolationsTable)
        .values({
          title: 'Recent Violation',
          description: 'Recent violation test',
          violation_type: 'DataLeak',
          severity: 'Critical',
          status: 'Open',
          incident_date: new Date('2024-01-20'),
          created_by: testUserId
        })
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        incident_after: new Date('2024-01-10'),
        incident_before: new Date('2024-01-18')
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Test Security Breach');
      expect(result[0].incident_date >= new Date('2024-01-10')).toBe(true);
      expect(result[0].incident_date <= new Date('2024-01-18')).toBe(true);
    });

    it('should apply multiple filters correctly', async () => {
      // Create multiple violations with different attributes
      await db.insert(securityViolationsTable)
        .values([
          {
            title: 'High Severity Open',
            description: 'High severity open violation',
            violation_type: 'SecurityBreach',
            severity: 'High',
            status: 'Open',
            incident_date: new Date('2024-01-16'),
            container_id: testContainerId,
            created_by: testUserId
          },
          {
            title: 'High Severity Closed',
            description: 'High severity closed violation',
            violation_type: 'SecurityBreach',
            severity: 'High',
            status: 'Closed',
            incident_date: new Date('2024-01-17'),
            container_id: testContainerId,
            created_by: testUserId
          },
          {
            title: 'Medium Severity Open',
            description: 'Medium severity open violation',
            violation_type: 'SecurityBreach',
            severity: 'Medium',
            status: 'Open',
            incident_date: new Date('2024-01-18'),
            container_id: testContainerId,
            created_by: testUserId
          }
        ])
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        severity: 'High',
        status: 'Open',
        container_id: testContainerId
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(2);
      result.forEach(violation => {
        expect(violation.severity).toEqual('High');
        expect(violation.status).toEqual('Open');
        expect(violation.container_id).toEqual(testContainerId);
      });
    });

    it('should apply pagination correctly', async () => {
      // Create multiple violations
      await db.insert(securityViolationsTable)
        .values([
          {
            title: 'Violation 1',
            description: 'Test violation 1',
            violation_type: 'PolicyViolation',
            severity: 'Medium',
            status: 'Open',
            incident_date: new Date('2024-01-16'),
            created_by: testUserId
          },
          {
            title: 'Violation 2',
            description: 'Test violation 2',
            violation_type: 'ComplianceIssue',
            severity: 'Low',
            status: 'Open',
            incident_date: new Date('2024-01-17'),
            created_by: testUserId
          },
          {
            title: 'Violation 3',
            description: 'Test violation 3',
            violation_type: 'DataLeak',
            severity: 'High',
            status: 'In-progress',
            incident_date: new Date('2024-01-18'),
            created_by: testUserId
          }
        ])
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        limit: 2,
        offset: 1
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(2);
      // Should skip the first result due to offset
    });

    it('should apply custom ordering correctly', async () => {
      // Create violations with different incident dates
      await db.insert(securityViolationsTable)
        .values([
          {
            title: 'Earlier Violation',
            description: 'Earlier violation',
            violation_type: 'PolicyViolation',
            severity: 'Medium',
            status: 'Open',
            incident_date: new Date('2024-01-10'),
            created_by: testUserId
          },
          {
            title: 'Later Violation',
            description: 'Later violation',
            violation_type: 'ComplianceIssue',
            severity: 'Low',
            status: 'Open',
            incident_date: new Date('2024-01-20'),
            created_by: testUserId
          }
        ])
        .execute();

      const filters: Partial<GetSecurityViolationsInput> = {
        order_by: 'incident_date'
      };

      const result = await getSecurityViolations(filters);

      expect(result).toHaveLength(3);
      // Should be ordered by incident_date descending
      expect(result[0].incident_date >= result[1].incident_date).toBe(true);
      expect(result[1].incident_date >= result[2].incident_date).toBe(true);
    });
  });

  describe('getActiveSecurityViolations', () => {
    it('should fetch only open and in-progress violations', async () => {
      // Create violations with different statuses
      await db.insert(securityViolationsTable)
        .values([
          {
            title: 'In Progress Violation',
            description: 'In progress violation',
            violation_type: 'PolicyViolation',
            severity: 'Medium',
            status: 'In-progress',
            incident_date: new Date('2024-01-16'),
            created_by: testUserId
          },
          {
            title: 'Closed Violation',
            description: 'Closed violation',
            violation_type: 'ComplianceIssue',
            severity: 'Low',
            status: 'Closed',
            incident_date: new Date('2024-01-17'),
            created_by: testUserId
          },
          {
            title: 'Resolved Violation',
            description: 'Resolved violation',
            violation_type: 'DataLeak',
            severity: 'High',
            status: 'Resolved',
            incident_date: new Date('2024-01-18'),
            created_by: testUserId
          }
        ])
        .execute();

      const result = await getActiveSecurityViolations();

      expect(result).toHaveLength(2);
      result.forEach(violation => {
        expect(['Open', 'In-progress']).toContain(violation.status);
      });

      // Should be ordered by severity then creation date
      const openViolation = result.find(v => v.status === 'Open');
      const inProgressViolation = result.find(v => v.status === 'In-progress');

      expect(openViolation).toBeDefined();
      expect(inProgressViolation).toBeDefined();
    });

    it('should return empty array when no active violations exist', async () => {
      // Update existing violation to closed
      await db.update(securityViolationsTable)
        .set({ status: 'Resolved' })
        .where(eq(securityViolationsTable.id, testViolationId))
        .execute();

      const result = await getActiveSecurityViolations();

      expect(result).toHaveLength(0);
    });

    it('should prioritize violations by severity', async () => {
      // Create violations with different severities
      await db.insert(securityViolationsTable)
        .values([
          {
            title: 'Critical Open Violation',
            description: 'Critical violation',
            violation_type: 'SecurityBreach',
            severity: 'Critical',
            status: 'Open',
            incident_date: new Date('2024-01-16'),
            created_by: testUserId
          },
          {
            title: 'Low Open Violation',
            description: 'Low violation',
            violation_type: 'PolicyViolation',
            severity: 'Low',
            status: 'In-progress',
            incident_date: new Date('2024-01-17'),
            created_by: testUserId
          }
        ])
        .execute();

      const result = await getActiveSecurityViolations();

      expect(result).toHaveLength(3);
      // Critical should come first due to severity ordering
      expect(result[0].severity).toEqual('Critical');
    });
  });

  describe('getSecurityViolationsWithDetails', () => {
    it('should fetch violations with container and assignee details', async () => {
      const result = await getSecurityViolationsWithDetails();

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Test Security Breach');
      expect(result[0].container_name).toEqual('Test Container');
      expect(result[0].assignee_name).toEqual('Test User');
      expect(result[0].violation_type).toEqual('SecurityBreach');
      expect(result[0].severity).toEqual('High');
    });

    it('should handle null container and assignee correctly', async () => {
      // Create violation without container and assignee
      await db.insert(securityViolationsTable)
        .values({
          title: 'Unassigned Violation',
          description: 'Violation without assignment',
          violation_type: 'PolicyViolation',
          severity: 'Medium',
          status: 'Open',
          incident_date: new Date('2024-01-16'),
          container_id: null,
          assigned_to: null,
          created_by: testUserId
        })
        .execute();

      const result = await getSecurityViolationsWithDetails();

      const unassignedViolation = result.find(v => v.title === 'Unassigned Violation');
      expect(unassignedViolation).toBeDefined();
      expect(unassignedViolation!.container_name).toBeNull();
      expect(unassignedViolation!.assignee_name).toBeNull();
    });

    it('should support filtering with joined data', async () => {
      const filters: Partial<GetSecurityViolationsInput> = {
        container_id: testContainerId,
        severity: 'High'
      };

      const result = await getSecurityViolationsWithDetails(filters);

      expect(result).toHaveLength(1);
      expect(result[0].container_id).toEqual(testContainerId);
      expect(result[0].container_name).toEqual('Test Container');
      expect(result[0].severity).toEqual('High');
    });
  });
});