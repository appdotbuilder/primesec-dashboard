import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { architectureComponentsTable, containersTable, usersTable } from '../db/schema';
import { type CreateArchitectureComponentInput } from '../schema';
import { createArchitectureComponent } from '../handlers/create_architecture_component';
import { eq } from 'drizzle-orm';

describe('createArchitectureComponent', () => {
  let testUserId: number;
  let testContainerId: number;

  beforeEach(async () => {
    await createDB();
    
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
    
    testUserId = userResult[0].id;

    // Create test container
    const containerResult = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'A container for testing',
        type: 'System',
        created_by: testUserId,
        is_active: true
      })
      .returning()
      .execute();
    
    testContainerId = containerResult[0].id;
  });

  afterEach(resetDB);

  const baseInput: CreateArchitectureComponentInput = {
    name: 'Web Server',
    component_type: 'Application Server',
    description: 'Main web application server',
    technology_stack: 'Node.js, Express',
    security_domain: 'Web Tier',
    trust_boundary: 'Internal',
    network_zone: 'DMZ',
    data_classification: 'Internal',
    position_x: 100,
    position_y: 200,
    container_id: 0, // Will be set in tests
    created_by: 0 // Will be set in tests
  };

  it('should create an architecture component', async () => {
    const testInput = {
      ...baseInput,
      container_id: testContainerId,
      created_by: testUserId
    };

    const result = await createArchitectureComponent(testInput);

    // Basic field validation
    expect(result.name).toEqual('Web Server');
    expect(result.component_type).toEqual('Application Server');
    expect(result.description).toEqual('Main web application server');
    expect(result.technology_stack).toEqual('Node.js, Express');
    expect(result.security_domain).toEqual('Web Tier');
    expect(result.trust_boundary).toEqual('Internal');
    expect(result.network_zone).toEqual('DMZ');
    expect(result.data_classification).toEqual('Internal');
    expect(typeof result.position_x).toBe('number');
    expect(result.position_x).toEqual(100);
    expect(typeof result.position_y).toBe('number');
    expect(result.position_y).toEqual(200);
    expect(result.container_id).toEqual(testContainerId);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.is_active).toBe(true);
  });

  it('should save component to database', async () => {
    const testInput = {
      ...baseInput,
      container_id: testContainerId,
      created_by: testUserId
    };

    const result = await createArchitectureComponent(testInput);

    const components = await db.select()
      .from(architectureComponentsTable)
      .where(eq(architectureComponentsTable.id, result.id))
      .execute();

    expect(components).toHaveLength(1);
    expect(components[0].name).toEqual('Web Server');
    expect(components[0].component_type).toEqual('Application Server');
    expect(components[0].description).toEqual('Main web application server');
    expect(components[0].technology_stack).toEqual('Node.js, Express');
    expect(components[0].security_domain).toEqual('Web Tier');
    expect(components[0].trust_boundary).toEqual('Internal');
    expect(components[0].network_zone).toEqual('DMZ');
    expect(components[0].data_classification).toEqual('Internal');
    expect(parseFloat(components[0].position_x!.toString())).toEqual(100);
    expect(parseFloat(components[0].position_y!.toString())).toEqual(200);
    expect(components[0].container_id).toEqual(testContainerId);
    expect(components[0].created_by).toEqual(testUserId);
    expect(components[0].created_at).toBeInstanceOf(Date);
    expect(components[0].updated_at).toBeInstanceOf(Date);
    expect(components[0].is_active).toBe(true);
  });

  it('should handle nullable fields correctly', async () => {
    const minimalInput: CreateArchitectureComponentInput = {
      name: 'Minimal Component',
      component_type: 'Service',
      description: null,
      technology_stack: null,
      security_domain: null,
      trust_boundary: null,
      network_zone: null,
      data_classification: null,
      position_x: null,
      position_y: null,
      container_id: testContainerId,
      created_by: testUserId
    };

    const result = await createArchitectureComponent(minimalInput);

    expect(result.name).toEqual('Minimal Component');
    expect(result.component_type).toEqual('Service');
    expect(result.description).toBeNull();
    expect(result.technology_stack).toBeNull();
    expect(result.security_domain).toBeNull();
    expect(result.trust_boundary).toBeNull();
    expect(result.network_zone).toBeNull();
    expect(result.data_classification).toBeNull();
    expect(result.position_x).toBeNull();
    expect(result.position_y).toBeNull();
    expect(result.container_id).toEqual(testContainerId);
    expect(result.created_by).toEqual(testUserId);
    expect(result.is_active).toBe(true);
  });

  it('should handle numeric position values correctly', async () => {
    const testInput = {
      ...baseInput,
      position_x: 123.45,
      position_y: 678.90,
      container_id: testContainerId,
      created_by: testUserId
    };

    const result = await createArchitectureComponent(testInput);

    expect(typeof result.position_x).toBe('number');
    expect(typeof result.position_y).toBe('number');
    expect(result.position_x).toEqual(123.45);
    expect(result.position_y).toEqual(678.90);

    // Verify in database
    const components = await db.select()
      .from(architectureComponentsTable)
      .where(eq(architectureComponentsTable.id, result.id))
      .execute();

    expect(parseFloat(components[0].position_x!.toString())).toEqual(123.45);
    expect(parseFloat(components[0].position_y!.toString())).toEqual(678.90);
  });

  it('should throw error for non-existent container', async () => {
    const testInput = {
      ...baseInput,
      container_id: 99999, // Non-existent container
      created_by: testUserId
    };

    await expect(createArchitectureComponent(testInput)).rejects.toThrow(/Container with ID 99999 not found/i);
  });

  it('should throw error for inactive container', async () => {
    // Create inactive container
    const inactiveContainerResult = await db.insert(containersTable)
      .values({
        name: 'Inactive Container',
        description: 'An inactive container',
        type: 'System',
        created_by: testUserId,
        is_active: false
      })
      .returning()
      .execute();

    const testInput = {
      ...baseInput,
      container_id: inactiveContainerResult[0].id,
      created_by: testUserId
    };

    await expect(createArchitectureComponent(testInput)).rejects.toThrow(/Container with ID .* not found or inactive/i);
  });

  it('should throw error for non-existent user', async () => {
    const testInput = {
      ...baseInput,
      container_id: testContainerId,
      created_by: 99999 // Non-existent user
    };

    await expect(createArchitectureComponent(testInput)).rejects.toThrow(/User with ID 99999 not found/i);
  });

  it('should throw error for inactive user', async () => {
    // Create inactive user
    const inactiveUserResult = await db.insert(usersTable)
      .values({
        username: 'inactiveuser',
        email: 'inactive@example.com',
        full_name: 'Inactive User',
        role: 'Viewer',
        is_active: false
      })
      .returning()
      .execute();

    const testInput = {
      ...baseInput,
      container_id: testContainerId,
      created_by: inactiveUserResult[0].id
    };

    await expect(createArchitectureComponent(testInput)).rejects.toThrow(/User with ID .* not found or inactive/i);
  });

  it('should create components with same name but different containers', async () => {
    // Create second container
    const container2Result = await db.insert(containersTable)
      .values({
        name: 'Second Container',
        description: 'Another test container',
        type: 'Application',
        created_by: testUserId,
        is_active: true
      })
      .returning()
      .execute();

    const testInput1 = {
      ...baseInput,
      container_id: testContainerId,
      created_by: testUserId
    };

    const testInput2 = {
      ...baseInput,
      container_id: container2Result[0].id,
      created_by: testUserId
    };

    const result1 = await createArchitectureComponent(testInput1);
    const result2 = await createArchitectureComponent(testInput2);

    expect(result1.name).toEqual(result2.name);
    expect(result1.container_id).not.toEqual(result2.container_id);
    expect(result1.id).not.toEqual(result2.id);

    // Both should be saved to database
    const allComponents = await db.select()
      .from(architectureComponentsTable)
      .execute();

    expect(allComponents).toHaveLength(2);
  });
});