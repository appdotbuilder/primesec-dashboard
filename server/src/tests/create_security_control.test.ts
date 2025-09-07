import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, securityControlsTable } from '../db/schema';
import { type CreateSecurityControlInput } from '../schema';
import { createSecurityControl } from '../handlers/create_security_control';
import { eq } from 'drizzle-orm';

// Test data for prerequisites
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'Admin' as const
};

const testContainer = {
  name: 'Test Container',
  description: 'A container for testing',
  type: 'Project' as const,
  created_by: 1
};

// Test input with all required fields
const testInput: CreateSecurityControlInput = {
  name: 'Access Control Policy',
  description: 'Comprehensive access control policy for user authentication and authorization',
  control_type: 'Administrative',
  implementation_status: 'Existing',
  effectiveness_rating: 85.5,
  framework_reference: 'NIST CSF',
  control_family: 'Access Control',
  implementation_notes: 'Implemented using RBAC model with regular reviews',
  testing_frequency: 'Quarterly',
  last_tested: new Date('2024-01-15'),
  container_id: 1,
  created_by: 1
};

describe('createSecurityControl', () => {
  let userId: number;
  let containerId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test container
    const containerResult = await db.insert(containersTable)
      .values({ ...testContainer, created_by: userId })
      .returning()
      .execute();
    containerId = containerResult[0].id;

    // Update test input with actual IDs
    testInput.container_id = containerId;
    testInput.created_by = userId;
  });

  afterEach(resetDB);

  it('should create a security control with all fields', async () => {
    const result = await createSecurityControl(testInput);

    // Basic field validation
    expect(result.name).toEqual('Access Control Policy');
    expect(result.description).toEqual(testInput.description);
    expect(result.control_type).toEqual('Administrative');
    expect(result.implementation_status).toEqual('Existing');
    expect(result.effectiveness_rating).toEqual(85.5);
    expect(typeof result.effectiveness_rating).toEqual('number');
    expect(result.framework_reference).toEqual('NIST CSF');
    expect(result.control_family).toEqual('Access Control');
    expect(result.implementation_notes).toEqual(testInput.implementation_notes);
    expect(result.testing_frequency).toEqual('Quarterly');
    expect(result.last_tested).toEqual(testInput.last_tested);
    expect(result.container_id).toEqual(containerId);
    expect(result.created_by).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.is_active).toEqual(true);
  });

  it('should save security control to database', async () => {
    const result = await createSecurityControl(testInput);

    // Query using proper drizzle syntax
    const controls = await db.select()
      .from(securityControlsTable)
      .where(eq(securityControlsTable.id, result.id))
      .execute();

    expect(controls).toHaveLength(1);
    expect(controls[0].name).toEqual('Access Control Policy');
    expect(controls[0].description).toEqual(testInput.description);
    expect(controls[0].control_type).toEqual('Administrative');
    expect(controls[0].implementation_status).toEqual('Existing');
    expect(parseFloat(controls[0].effectiveness_rating!.toString())).toEqual(85.5);
    expect(controls[0].framework_reference).toEqual('NIST CSF');
    expect(controls[0].control_family).toEqual('Access Control');
    expect(controls[0].container_id).toEqual(containerId);
    expect(controls[0].created_by).toEqual(userId);
    expect(controls[0].created_at).toBeInstanceOf(Date);
    expect(controls[0].updated_at).toBeInstanceOf(Date);
    expect(controls[0].is_active).toEqual(true);
  });

  it('should create security control with minimal required fields', async () => {
    const minimalInput: CreateSecurityControlInput = {
      name: 'Minimal Control',
      description: null,
      control_type: 'Technical',
      implementation_status: 'Planned',
      effectiveness_rating: null,
      framework_reference: null,
      control_family: null,
      implementation_notes: null,
      testing_frequency: null,
      last_tested: null,
      container_id: containerId,
      created_by: userId
    };

    const result = await createSecurityControl(minimalInput);

    expect(result.name).toEqual('Minimal Control');
    expect(result.description).toBeNull();
    expect(result.control_type).toEqual('Technical');
    expect(result.implementation_status).toEqual('Planned');
    expect(result.effectiveness_rating).toBeNull();
    expect(result.framework_reference).toBeNull();
    expect(result.control_family).toBeNull();
    expect(result.implementation_notes).toBeNull();
    expect(result.testing_frequency).toBeNull();
    expect(result.last_tested).toBeNull();
    expect(result.container_id).toEqual(containerId);
    expect(result.created_by).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.is_active).toEqual(true);
  });

  it('should handle different implementation statuses', async () => {
    const statuses = ['Existing', 'Planned', 'NotSpecified'] as const;

    for (const status of statuses) {
      const input = { ...testInput, implementation_status: status, name: `Control ${status}` };
      const result = await createSecurityControl(input);

      expect(result.implementation_status).toEqual(status);
      expect(result.name).toEqual(`Control ${status}`);
    }
  });

  it('should handle different control types', async () => {
    const controlTypes = [
      'Administrative',
      'Technical',
      'Physical',
      'Preventive',
      'Detective',
      'Corrective'
    ];

    for (const controlType of controlTypes) {
      const input = { ...testInput, control_type: controlType, name: `${controlType} Control` };
      const result = await createSecurityControl(input);

      expect(result.control_type).toEqual(controlType);
      expect(result.name).toEqual(`${controlType} Control`);
    }
  });

  it('should handle different framework references', async () => {
    const frameworks = ['NIST CSF', 'ISO 27001', 'SOC 2', 'PCI DSS', 'HIPAA'];

    for (const framework of frameworks) {
      const input = { ...testInput, framework_reference: framework, name: `${framework} Control` };
      const result = await createSecurityControl(input);

      expect(result.framework_reference).toEqual(framework);
      expect(result.name).toEqual(`${framework} Control`);
    }
  });

  it('should handle effectiveness rating edge cases', async () => {
    // Test minimum effectiveness rating (0)
    const minRatingInput = { ...testInput, effectiveness_rating: 0, name: 'Min Rating Control' };
    const minResult = await createSecurityControl(minRatingInput);
    expect(minResult.effectiveness_rating).toEqual(0);

    // Test maximum effectiveness rating (100)
    const maxRatingInput = { ...testInput, effectiveness_rating: 100, name: 'Max Rating Control' };
    const maxResult = await createSecurityControl(maxRatingInput);
    expect(maxResult.effectiveness_rating).toEqual(100);

    // Test decimal effectiveness rating
    const decimalInput = { ...testInput, effectiveness_rating: 75.75, name: 'Decimal Rating Control' };
    const decimalResult = await createSecurityControl(decimalInput);
    expect(decimalResult.effectiveness_rating).toEqual(75.75);
  });

  it('should throw error for non-existent container', async () => {
    const invalidInput = { ...testInput, container_id: 999 };

    expect(createSecurityControl(invalidInput)).rejects.toThrow(/Container with id 999 not found/i);
  });

  it('should throw error for non-existent user', async () => {
    const invalidInput = { ...testInput, created_by: 999 };

    expect(createSecurityControl(invalidInput)).rejects.toThrow(/User with id 999 not found/i);
  });

  it('should handle date fields correctly', async () => {
    const testDate = new Date('2023-12-01T10:30:00Z');
    const input = { ...testInput, last_tested: testDate };

    const result = await createSecurityControl(input);

    expect(result.last_tested).toEqual(testDate);
    expect(result.last_tested).toBeInstanceOf(Date);
  });
});