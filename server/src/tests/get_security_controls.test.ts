import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, securityControlsTable } from '../db/schema';
import { getSecurityControls, getSecurityControlsByContainer } from '../handlers/get_security_controls';
import { eq } from 'drizzle-orm';

describe('getSecurityControls', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testContainerId1: number;
  let testContainerId2: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test containers
    const container1 = await db.insert(containersTable)
      .values({
        name: 'Test Container 1',
        description: 'First test container',
        type: 'Project',
        created_by: testUserId
      })
      .returning()
      .execute();
    testContainerId1 = container1[0].id;

    const container2 = await db.insert(containersTable)
      .values({
        name: 'Test Container 2',
        description: 'Second test container',
        type: 'Application',
        created_by: testUserId
      })
      .returning()
      .execute();
    testContainerId2 = container2[0].id;

    // Create test security controls
    await db.insert(securityControlsTable)
      .values([
        {
          name: 'Access Control Policy',
          description: 'Implement access control mechanisms',
          control_type: 'Administrative',
          implementation_status: 'Existing',
          effectiveness_rating: 85.5,
          framework_reference: 'NIST',
          control_family: 'Access Control',
          implementation_notes: 'Fully implemented with regular reviews',
          testing_frequency: 'Annual',
          container_id: testContainerId1,
          created_by: testUserId
        },
        {
          name: 'Encryption at Rest',
          description: 'Encrypt sensitive data at rest',
          control_type: 'Technical',
          implementation_status: 'Planned',
          effectiveness_rating: null,
          framework_reference: 'ISO',
          control_family: 'Cryptography',
          implementation_notes: 'Planning phase',
          testing_frequency: 'Quarterly',
          container_id: testContainerId1,
          created_by: testUserId
        },
        {
          name: 'Network Segmentation',
          description: 'Implement network segmentation controls',
          control_type: 'Technical',
          implementation_status: 'Existing',
          effectiveness_rating: 92.0,
          framework_reference: 'NIST',
          control_family: 'Network Security',
          implementation_notes: 'Implemented with firewall rules',
          testing_frequency: 'Monthly',
          container_id: testContainerId2,
          created_by: testUserId
        },
        {
          name: 'Inactive Control',
          description: 'This control is inactive',
          control_type: 'Physical',
          implementation_status: 'NotSpecified',
          effectiveness_rating: 0.0,
          framework_reference: 'Custom',
          control_family: 'Physical Security',
          implementation_notes: 'Deactivated control',
          testing_frequency: 'Never',
          container_id: testContainerId1,
          created_by: testUserId,
          is_active: false
        }
      ])
      .execute();
  });

  it('should fetch all security controls without filters', async () => {
    const results = await getSecurityControls();

    expect(results).toHaveLength(4);
    expect(results[0].name).toBeDefined();
    expect(results[0].control_type).toBeDefined();
    expect(results[0].implementation_status).toBeDefined();
    expect(results[0].container_id).toBeDefined();
    expect(results[0].created_by).toBeDefined();
    expect(results[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter by implementation status', async () => {
    const results = await getSecurityControls({ implementation_status: 'Existing' });

    expect(results).toHaveLength(2);
    results.forEach(control => {
      expect(control.implementation_status).toBe('Existing');
    });
  });

  it('should filter by control type', async () => {
    const results = await getSecurityControls({ control_type: 'Technical' });

    expect(results).toHaveLength(2);
    results.forEach(control => {
      expect(control.control_type).toBe('Technical');
    });
  });

  it('should filter by framework reference', async () => {
    const results = await getSecurityControls({ framework_reference: 'NIST' });

    expect(results).toHaveLength(2);
    results.forEach(control => {
      expect(control.framework_reference).toBe('NIST');
    });
  });

  it('should filter by container_id', async () => {
    const results = await getSecurityControls({ container_id: testContainerId1 });

    expect(results).toHaveLength(3);
    results.forEach(control => {
      expect(control.container_id).toBe(testContainerId1);
    });
  });

  it('should filter by control family', async () => {
    const results = await getSecurityControls({ control_family: 'Access Control' });

    expect(results).toHaveLength(1);
    expect(results[0].control_family).toBe('Access Control');
    expect(results[0].name).toBe('Access Control Policy');
  });

  it('should filter by active status', async () => {
    const results = await getSecurityControls({ is_active: true });

    expect(results).toHaveLength(3);
    results.forEach(control => {
      expect(control.is_active).toBe(true);
    });

    const inactiveResults = await getSecurityControls({ is_active: false });
    expect(inactiveResults).toHaveLength(1);
    expect(inactiveResults[0].name).toBe('Inactive Control');
  });

  it('should apply multiple filters correctly', async () => {
    const results = await getSecurityControls({
      implementation_status: 'Existing',
      control_type: 'Technical',
      framework_reference: 'NIST'
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Network Segmentation');
    expect(results[0].implementation_status).toBe('Existing');
    expect(results[0].control_type).toBe('Technical');
    expect(results[0].framework_reference).toBe('NIST');
  });

  it('should handle numeric conversions for effectiveness_rating', async () => {
    const results = await getSecurityControls({ implementation_status: 'Existing' });

    const accessControl = results.find(c => c.name === 'Access Control Policy');
    const networkSeg = results.find(c => c.name === 'Network Segmentation');

    expect(accessControl?.effectiveness_rating).toBe(85.5);
    expect(typeof accessControl?.effectiveness_rating).toBe('number');
    expect(networkSeg?.effectiveness_rating).toBe(92.0);
    expect(typeof networkSeg?.effectiveness_rating).toBe('number');
  });

  it('should handle null effectiveness_rating values', async () => {
    const results = await getSecurityControls({ implementation_status: 'Planned' });

    expect(results).toHaveLength(1);
    expect(results[0].effectiveness_rating).toBeNull();
  });

  it('should return empty array when no controls match filters', async () => {
    const results = await getSecurityControls({ 
      framework_reference: 'NonExistentFramework' 
    });

    expect(results).toHaveLength(0);
  });
});

describe('getSecurityControlsByContainer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testContainerId1: number;
  let testContainerId2: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test containers
    const container1 = await db.insert(containersTable)
      .values({
        name: 'Test Container 1',
        description: 'First test container',
        type: 'Project',
        created_by: testUserId
      })
      .returning()
      .execute();
    testContainerId1 = container1[0].id;

    const container2 = await db.insert(containersTable)
      .values({
        name: 'Test Container 2',
        description: 'Second test container',
        type: 'Application',
        created_by: testUserId
      })
      .returning()
      .execute();
    testContainerId2 = container2[0].id;

    // Create test security controls for different containers
    await db.insert(securityControlsTable)
      .values([
        {
          name: 'Container 1 Control A',
          description: 'First control for container 1',
          control_type: 'Administrative',
          implementation_status: 'Existing',
          effectiveness_rating: 75.5,
          framework_reference: 'NIST',
          control_family: 'Access Control',
          container_id: testContainerId1,
          created_by: testUserId
        },
        {
          name: 'Container 1 Control B',
          description: 'Second control for container 1',
          control_type: 'Technical',
          implementation_status: 'Planned',
          effectiveness_rating: null,
          framework_reference: 'ISO',
          control_family: 'Cryptography',
          container_id: testContainerId1,
          created_by: testUserId
        },
        {
          name: 'Container 2 Control A',
          description: 'First control for container 2',
          control_type: 'Technical',
          implementation_status: 'Existing',
          effectiveness_rating: 88.0,
          framework_reference: 'NIST',
          control_family: 'Network Security',
          container_id: testContainerId2,
          created_by: testUserId
        }
      ])
      .execute();
  });

  it('should fetch controls for specific container', async () => {
    const results = await getSecurityControlsByContainer(testContainerId1);

    expect(results).toHaveLength(2);
    results.forEach(control => {
      expect(control.container_id).toBe(testContainerId1);
    });

    const controlNames = results.map(c => c.name);
    expect(controlNames).toContain('Container 1 Control A');
    expect(controlNames).toContain('Container 1 Control B');
  });

  it('should fetch controls for different container', async () => {
    const results = await getSecurityControlsByContainer(testContainerId2);

    expect(results).toHaveLength(1);
    expect(results[0].container_id).toBe(testContainerId2);
    expect(results[0].name).toBe('Container 2 Control A');
  });

  it('should handle numeric conversions correctly', async () => {
    const results = await getSecurityControlsByContainer(testContainerId1);

    const controlA = results.find(c => c.name === 'Container 1 Control A');
    const controlB = results.find(c => c.name === 'Container 1 Control B');

    expect(controlA?.effectiveness_rating).toBe(75.5);
    expect(typeof controlA?.effectiveness_rating).toBe('number');
    expect(controlB?.effectiveness_rating).toBeNull();
  });

  it('should return empty array for non-existent container', async () => {
    const results = await getSecurityControlsByContainer(99999);

    expect(results).toHaveLength(0);
  });

  it('should verify controls exist in database', async () => {
    await getSecurityControlsByContainer(testContainerId1);

    // Verify data exists in database
    const dbControls = await db.select()
      .from(securityControlsTable)
      .where(eq(securityControlsTable.container_id, testContainerId1))
      .execute();

    expect(dbControls).toHaveLength(2);
    expect(dbControls[0].container_id).toBe(testContainerId1);
  });

  it('should include all control fields', async () => {
    const results = await getSecurityControlsByContainer(testContainerId2);

    expect(results).toHaveLength(1);
    const control = results[0];

    expect(control.id).toBeDefined();
    expect(control.name).toBe('Container 2 Control A');
    expect(control.description).toBe('First control for container 2');
    expect(control.control_type).toBe('Technical');
    expect(control.implementation_status).toBe('Existing');
    expect(control.effectiveness_rating).toBe(88.0);
    expect(control.framework_reference).toBe('NIST');
    expect(control.control_family).toBe('Network Security');
    expect(control.container_id).toBe(testContainerId2);
    expect(control.created_by).toBe(testUserId);
    expect(control.created_at).toBeInstanceOf(Date);
    expect(control.updated_at).toBeInstanceOf(Date);
    expect(control.is_active).toBe(true);
  });
});