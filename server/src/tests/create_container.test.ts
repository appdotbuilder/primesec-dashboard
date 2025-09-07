import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { containersTable, usersTable } from '../db/schema';
import { type CreateContainerInput } from '../schema';
import { createContainer } from '../handlers/create_container';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'SecurityAnalyst' as const,
  is_active: true
};

// Test container input
const testInput: CreateContainerInput = {
  name: 'Test Security Project',
  description: 'A test project for security analysis',
  type: 'Project',
  external_id: 'EXT-123',
  external_system: 'Jira',
  created_by: 1 // Will be set after creating test user
};

describe('createContainer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a container with all fields', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const input = { ...testInput, created_by: userId };
    const result = await createContainer(input);

    // Basic field validation
    expect(result.name).toEqual('Test Security Project');
    expect(result.description).toEqual(testInput.description);
    expect(result.type).toEqual('Project');
    expect(result.risk_score).toEqual(0);
    expect(result.external_id).toEqual('EXT-123');
    expect(result.external_system).toEqual('Jira');
    expect(result.created_by).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.is_active).toEqual(true);
    expect(typeof result.risk_score).toEqual('number');
  });

  it('should create a container with minimal required fields', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const minimalInput: CreateContainerInput = {
      name: 'Minimal Container',
      description: null,
      type: 'Application',
      external_id: null,
      external_system: null,
      created_by: userId
    };

    const result = await createContainer(minimalInput);

    expect(result.name).toEqual('Minimal Container');
    expect(result.description).toBeNull();
    expect(result.type).toEqual('Application');
    expect(result.risk_score).toEqual(0);
    expect(result.external_id).toBeNull();
    expect(result.external_system).toBeNull();
    expect(result.created_by).toEqual(userId);
    expect(result.is_active).toEqual(true);
  });

  it('should save container to database', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const input = { ...testInput, created_by: userId };
    const result = await createContainer(input);

    // Query using proper drizzle syntax
    const containers = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, result.id))
      .execute();

    expect(containers).toHaveLength(1);
    expect(containers[0].name).toEqual('Test Security Project');
    expect(containers[0].description).toEqual(testInput.description);
    expect(containers[0].type).toEqual('Project');
    expect(parseFloat(containers[0].risk_score.toString())).toEqual(0);
    expect(containers[0].external_id).toEqual('EXT-123');
    expect(containers[0].external_system).toEqual('Jira');
    expect(containers[0].created_by).toEqual(userId);
    expect(containers[0].created_at).toBeInstanceOf(Date);
    expect(containers[0].is_active).toEqual(true);
  });

  it('should create containers with different types', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const containerTypes = ['Project', 'Application', 'System', 'Service'] as const;

    for (const type of containerTypes) {
      const input: CreateContainerInput = {
        name: `Test ${type}`,
        description: `A test ${type.toLowerCase()}`,
        type,
        external_id: null,
        external_system: null,
        created_by: userId
      };

      const result = await createContainer(input);
      expect(result.type).toEqual(type);
      expect(result.name).toEqual(`Test ${type}`);
    }
  });

  it('should throw error when user does not exist', async () => {
    const input = { ...testInput, created_by: 999 }; // Non-existent user ID

    await expect(createContainer(input)).rejects.toThrow(/User with ID 999 does not exist/i);
  });

  it('should handle external system integration fields', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Test with Azure DevOps integration
    const azureInput: CreateContainerInput = {
      name: 'Azure DevOps Project',
      description: 'Integrated with Azure DevOps',
      type: 'Project',
      external_id: 'AZ-456',
      external_system: 'Azure DevOps',
      created_by: userId
    };

    const result = await createContainer(azureInput);

    expect(result.external_id).toEqual('AZ-456');
    expect(result.external_system).toEqual('Azure DevOps');
    expect(result.name).toEqual('Azure DevOps Project');
  });
});