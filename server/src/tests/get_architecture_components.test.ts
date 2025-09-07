import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, architectureComponentsTable } from '../db/schema';
import { getArchitectureComponents, getArchitectureComponentsByContainer, type GetArchitectureComponentsFilters } from '../handlers/get_architecture_components';

describe('getArchitectureComponents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let testUserId: number;
  let testContainerId: number;
  let testContainerId2: number;

  beforeEach(async () => {
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

    // Create test containers
    const containerResults = await db.insert(containersTable)
      .values([
        {
          name: 'Test Container 1',
          description: 'First test container',
          type: 'Application',
          created_by: testUserId
        },
        {
          name: 'Test Container 2',
          description: 'Second test container',
          type: 'System',
          created_by: testUserId
        }
      ])
      .returning()
      .execute();
    testContainerId = containerResults[0].id;
    testContainerId2 = containerResults[1].id;
  });

  it('should return all architecture components when no filters applied', async () => {
    // Create test components
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Web Server',
          component_type: 'Server',
          description: 'Main web server',
          technology_stack: 'Node.js',
          security_domain: 'DMZ',
          trust_boundary: 'External',
          network_zone: 'Public',
          data_classification: 'Internal',
          position_x: 100.5,
          position_y: 200.75,
          container_id: testContainerId,
          created_by: testUserId,
          is_active: true
        },
        {
          name: 'Database',
          component_type: 'Database',
          description: 'Primary database',
          technology_stack: 'PostgreSQL',
          security_domain: 'Internal',
          trust_boundary: 'Internal',
          network_zone: 'Private',
          data_classification: 'Confidential',
          position_x: 300.25,
          position_y: 400.0,
          container_id: testContainerId2,
          created_by: testUserId,
          is_active: true
        }
      ])
      .execute();

    const results = await getArchitectureComponents();

    expect(results).toHaveLength(2);
    expect(results[0].name).toEqual('Web Server');
    expect(results[0].component_type).toEqual('Server');
    expect(results[0].technology_stack).toEqual('Node.js');
    expect(results[0].position_x).toEqual(100.5);
    expect(results[0].position_y).toEqual(200.75);
    expect(typeof results[0].position_x).toEqual('number');
    expect(typeof results[0].position_y).toEqual('number');
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].updated_at).toBeInstanceOf(Date);
  });

  it('should filter by component_type', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Web Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'User Database',
          component_type: 'Database',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Cache Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      component_type: 'Server'
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(2);
    results.forEach(component => {
      expect(component.component_type).toEqual('Server');
    });
  });

  it('should filter by security_domain', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'DMZ Server',
          component_type: 'Server',
          security_domain: 'DMZ',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Internal DB',
          component_type: 'Database',
          security_domain: 'Internal',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'DMZ Load Balancer',
          component_type: 'LoadBalancer',
          security_domain: 'DMZ',
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      security_domain: 'DMZ'
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(2);
    results.forEach(component => {
      expect(component.security_domain).toEqual('DMZ');
    });
  });

  it('should filter by container_id', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Container 1 Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Container 2 Server',
          component_type: 'Server',
          container_id: testContainerId2,
          created_by: testUserId
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      container_id: testContainerId
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(1);
    expect(results[0].container_id).toEqual(testContainerId);
    expect(results[0].name).toEqual('Container 1 Server');
  });

  it('should filter by multiple criteria', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'DMZ Web Server',
          component_type: 'Server',
          security_domain: 'DMZ',
          trust_boundary: 'External',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Internal Web Server',
          component_type: 'Server',
          security_domain: 'Internal',
          trust_boundary: 'Internal',
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'DMZ Database',
          component_type: 'Database',
          security_domain: 'DMZ',
          trust_boundary: 'External',
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      component_type: 'Server',
      security_domain: 'DMZ',
      trust_boundary: 'External'
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('DMZ Web Server');
    expect(results[0].component_type).toEqual('Server');
    expect(results[0].security_domain).toEqual('DMZ');
    expect(results[0].trust_boundary).toEqual('External');
  });

  it('should filter by is_active status', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Active Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId,
          is_active: true
        },
        {
          name: 'Inactive Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId,
          is_active: false
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      is_active: true
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Active Server');
    expect(results[0].is_active).toEqual(true);
  });

  it('should handle null position values correctly', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Positioned Component',
          component_type: 'Server',
          position_x: 150.5,
          position_y: 250.75,
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Unpositioned Component',
          component_type: 'Database',
          position_x: null,
          position_y: null,
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const results = await getArchitectureComponents();

    expect(results).toHaveLength(2);
    
    const positioned = results.find(c => c.name === 'Positioned Component');
    const unpositioned = results.find(c => c.name === 'Unpositioned Component');

    expect(positioned?.position_x).toEqual(150.5);
    expect(positioned?.position_y).toEqual(250.75);
    expect(typeof positioned?.position_x).toEqual('number');
    expect(typeof positioned?.position_y).toEqual('number');

    expect(unpositioned?.position_x).toBeNull();
    expect(unpositioned?.position_y).toBeNull();
  });

  it('should return empty array when no components match filters', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Web Server',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const filters: GetArchitectureComponentsFilters = {
      component_type: 'NonExistentType'
    };

    const results = await getArchitectureComponents(filters);

    expect(results).toHaveLength(0);
  });
});

describe('getArchitectureComponentsByContainer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testContainerId: number;
  let testContainerId2: number;

  beforeEach(async () => {
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

    // Create test containers
    const containerResults = await db.insert(containersTable)
      .values([
        {
          name: 'Test Container 1',
          description: 'First test container',
          type: 'Application',
          created_by: testUserId
        },
        {
          name: 'Test Container 2',
          description: 'Second test container',
          type: 'System',
          created_by: testUserId
        }
      ])
      .returning()
      .execute();
    testContainerId = containerResults[0].id;
    testContainerId2 = containerResults[1].id;
  });

  it('should return components for specific container only', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Container 1 Web Server',
          component_type: 'Server',
          description: 'Web server for container 1',
          technology_stack: 'Apache',
          position_x: 100.0,
          position_y: 200.0,
          container_id: testContainerId,
          created_by: testUserId,
          is_active: true
        },
        {
          name: 'Container 1 Database',
          component_type: 'Database',
          description: 'Database for container 1',
          technology_stack: 'MySQL',
          position_x: 300.0,
          position_y: 400.0,
          container_id: testContainerId,
          created_by: testUserId,
          is_active: true
        },
        {
          name: 'Container 2 Server',
          component_type: 'Server',
          container_id: testContainerId2,
          created_by: testUserId,
          is_active: true
        }
      ])
      .execute();

    const results = await getArchitectureComponentsByContainer(testContainerId);

    expect(results).toHaveLength(2);
    results.forEach(component => {
      expect(component.container_id).toEqual(testContainerId);
      expect(component.is_active).toEqual(true);
    });

    const webServer = results.find(c => c.name === 'Container 1 Web Server');
    expect(webServer?.component_type).toEqual('Server');
    expect(webServer?.technology_stack).toEqual('Apache');
    expect(webServer?.position_x).toEqual(100.0);
    expect(webServer?.position_y).toEqual(200.0);
    expect(typeof webServer?.position_x).toEqual('number');
  });

  it('should only return active components', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Active Component',
          component_type: 'Server',
          container_id: testContainerId,
          created_by: testUserId,
          is_active: true
        },
        {
          name: 'Inactive Component',
          component_type: 'Database',
          container_id: testContainerId,
          created_by: testUserId,
          is_active: false
        }
      ])
      .execute();

    const results = await getArchitectureComponentsByContainer(testContainerId);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Active Component');
    expect(results[0].is_active).toEqual(true);
  });

  it('should handle positioning data for diagram rendering', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Frontend',
          component_type: 'WebApp',
          security_domain: 'DMZ',
          trust_boundary: 'External',
          network_zone: 'Public',
          data_classification: 'Public',
          position_x: 50.25,
          position_y: 100.75,
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Backend API',
          component_type: 'Service',
          security_domain: 'Internal',
          trust_boundary: 'Internal',
          network_zone: 'Private',
          data_classification: 'Internal',
          position_x: 200.5,
          position_y: 100.75,
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const results = await getArchitectureComponentsByContainer(testContainerId);

    expect(results).toHaveLength(2);
    
    const frontend = results.find(c => c.name === 'Frontend');
    const backend = results.find(c => c.name === 'Backend API');

    // Verify diagram positioning data
    expect(frontend?.position_x).toEqual(50.25);
    expect(frontend?.position_y).toEqual(100.75);
    expect(backend?.position_x).toEqual(200.5);
    expect(backend?.position_y).toEqual(100.75);

    // Verify trust boundary mappings
    expect(frontend?.trust_boundary).toEqual('External');
    expect(frontend?.security_domain).toEqual('DMZ');
    expect(backend?.trust_boundary).toEqual('Internal');
    expect(backend?.security_domain).toEqual('Internal');

    // Verify network zone mappings
    expect(frontend?.network_zone).toEqual('Public');
    expect(backend?.network_zone).toEqual('Private');
  });

  it('should return empty array for container with no components', async () => {
    const results = await getArchitectureComponentsByContainer(testContainerId);
    expect(results).toHaveLength(0);
  });

  it('should throw error for non-existent container', async () => {
    const nonExistentId = 999999;

    await expect(getArchitectureComponentsByContainer(nonExistentId))
      .rejects
      .toThrow(/Container with id 999999 does not exist/i);
  });

  it('should handle components with null positioning values', async () => {
    await db.insert(architectureComponentsTable)
      .values([
        {
          name: 'Positioned Component',
          component_type: 'Server',
          position_x: 100.0,
          position_y: 200.0,
          container_id: testContainerId,
          created_by: testUserId
        },
        {
          name: 'Unpositioned Component',
          component_type: 'Database',
          position_x: null,
          position_y: null,
          container_id: testContainerId,
          created_by: testUserId
        }
      ])
      .execute();

    const results = await getArchitectureComponentsByContainer(testContainerId);

    expect(results).toHaveLength(2);
    
    const positioned = results.find(c => c.name === 'Positioned Component');
    const unpositioned = results.find(c => c.name === 'Unpositioned Component');

    expect(positioned?.position_x).toEqual(100.0);
    expect(positioned?.position_y).toEqual(200.0);
    expect(unpositioned?.position_x).toBeNull();
    expect(unpositioned?.position_y).toBeNull();
  });
});