import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { containersTable, usersTable, securityIssuesTable } from '../db/schema';
import { getContainers } from '../handlers/get_containers';

describe('getContainers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no containers exist', async () => {
    const result = await getContainers();
    expect(result).toHaveLength(0);
  });

  it('should fetch active containers with basic properties', async () => {
    // Create test user first
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

    // Create test container
    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'A container for testing',
        type: 'Project',
        risk_score: 50,
        external_id: 'EXT-001',
        external_system: 'Jira',
        created_by: userId,
        is_active: true
      })
      .returning()
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test Container');
    expect(result[0].description).toEqual('A container for testing');
    expect(result[0].type).toEqual('Project');
    expect(result[0].external_id).toEqual('EXT-001');
    expect(result[0].external_system).toEqual('Jira');
    expect(result[0].created_by).toEqual(userId);
    expect(result[0].is_active).toBe(true);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should exclude inactive containers', async () => {
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

    // Create active container
    await db.insert(containersTable)
      .values({
        name: 'Active Container',
        description: 'Active container',
        type: 'Project',
        created_by: userId,
        is_active: true
      })
      .execute();

    // Create inactive container
    await db.insert(containersTable)
      .values({
        name: 'Inactive Container',
        description: 'Inactive container',
        type: 'Application',
        created_by: userId,
        is_active: false
      })
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Container');
    expect(result[0].is_active).toBe(true);
  });

  it('should calculate risk scores based on security issues', async () => {
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

    // Create containers
    const containerResults = await db.insert(containersTable)
      .values([
        {
          name: 'High Risk Container',
          description: 'Container with high-risk issues',
          type: 'Project',
          created_by: userId,
          is_active: true
        },
        {
          name: 'Low Risk Container',
          description: 'Container with low-risk issues',
          type: 'Application',
          created_by: userId,
          is_active: true
        },
        {
          name: 'No Issues Container',
          description: 'Container with no issues',
          type: 'System',
          created_by: userId,
          is_active: true
        }
      ])
      .returning()
      .execute();

    const highRiskContainerId = containerResults[0].id;
    const lowRiskContainerId = containerResults[1].id;
    const noIssuesContainerId = containerResults[2].id;

    // Create security issues with different risk scores
    await db.insert(securityIssuesTable)
      .values([
        // High-risk container issues (should average to 85)
        {
          title: 'Critical Issue 1',
          description: 'Critical security issue',
          severity: 'Critical',
          classification: 'Vulnerability',
          hierarchy: 'Epic',
          risk_score: 90,
          container_id: highRiskContainerId,
          created_by: userId
        },
        {
          title: 'High Issue 1',
          description: 'High security issue',
          severity: 'High',
          classification: 'Misconfiguration',
          hierarchy: 'Story',
          risk_score: 80,
          container_id: highRiskContainerId,
          created_by: userId
        },
        // Low-risk container issues (should average to 25)
        {
          title: 'Low Issue 1',
          description: 'Low security issue',
          severity: 'Low',
          classification: 'Weakness',
          hierarchy: 'Task',
          risk_score: 20,
          container_id: lowRiskContainerId,
          created_by: userId
        },
        {
          title: 'Medium Issue 1',
          description: 'Medium security issue',
          severity: 'Medium',
          classification: 'Exposure',
          hierarchy: 'Task',
          risk_score: 30,
          container_id: lowRiskContainerId,
          created_by: userId
        }
      ])
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(3);

    // Find containers by name for assertions
    const highRiskContainer = result.find(c => c.name === 'High Risk Container');
    const lowRiskContainer = result.find(c => c.name === 'Low Risk Container');
    const noIssuesContainer = result.find(c => c.name === 'No Issues Container');

    // Verify risk score calculations
    expect(highRiskContainer).toBeDefined();
    expect(highRiskContainer!.risk_score).toEqual(85); // (90 + 80) / 2

    expect(lowRiskContainer).toBeDefined();
    expect(lowRiskContainer!.risk_score).toEqual(25); // (20 + 30) / 2

    expect(noIssuesContainer).toBeDefined();
    expect(noIssuesContainer!.risk_score).toEqual(0); // No issues
  });

  it('should handle containers with different types', async () => {
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

    // Create containers of different types
    await db.insert(containersTable)
      .values([
        {
          name: 'Project Container',
          description: 'Project type container',
          type: 'Project',
          created_by: userId,
          is_active: true
        },
        {
          name: 'Application Container',
          description: 'Application type container',
          type: 'Application',
          created_by: userId,
          is_active: true
        },
        {
          name: 'System Container',
          description: 'System type container',
          type: 'System',
          created_by: userId,
          is_active: true
        },
        {
          name: 'Service Container',
          description: 'Service type container',
          type: 'Service',
          created_by: userId,
          is_active: true
        }
      ])
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(4);

    const types = result.map(c => c.type);
    expect(types).toContain('Project');
    expect(types).toContain('Application');
    expect(types).toContain('System');
    expect(types).toContain('Service');
  });

  it('should handle containers with null descriptions', async () => {
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

    // Create container with null description
    await db.insert(containersTable)
      .values({
        name: 'Container Without Description',
        description: null,
        type: 'Project',
        created_by: userId,
        is_active: true
      })
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Container Without Description');
    expect(result[0].description).toBeNull();
  });

  it('should handle containers with external integration data', async () => {
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

    // Create containers with and without external data
    await db.insert(containersTable)
      .values([
        {
          name: 'Jira Container',
          description: 'Container linked to Jira',
          type: 'Project',
          external_id: 'PROJ-123',
          external_system: 'Jira',
          created_by: userId,
          is_active: true
        },
        {
          name: 'Azure DevOps Container',
          description: 'Container linked to Azure DevOps',
          type: 'Application',
          external_id: 'AZ-456',
          external_system: 'Azure DevOps',
          created_by: userId,
          is_active: true
        },
        {
          name: 'Internal Container',
          description: 'Container without external links',
          type: 'System',
          external_id: null,
          external_system: null,
          created_by: userId,
          is_active: true
        }
      ])
      .execute();

    const result = await getContainers();

    expect(result).toHaveLength(3);

    const jiraContainer = result.find(c => c.name === 'Jira Container');
    expect(jiraContainer).toBeDefined();
    expect(jiraContainer!.external_id).toEqual('PROJ-123');
    expect(jiraContainer!.external_system).toEqual('Jira');

    const azureContainer = result.find(c => c.name === 'Azure DevOps Container');
    expect(azureContainer).toBeDefined();
    expect(azureContainer!.external_id).toEqual('AZ-456');
    expect(azureContainer!.external_system).toEqual('Azure DevOps');

    const internalContainer = result.find(c => c.name === 'Internal Container');
    expect(internalContainer).toBeDefined();
    expect(internalContainer!.external_id).toBeNull();
    expect(internalContainer!.external_system).toBeNull();
  });
});