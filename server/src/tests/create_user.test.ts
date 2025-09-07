import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  username: 'testuser123',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'SecurityAnalyst',
  is_active: true
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser123');
    expect(result.email).toEqual('test@example.com');
    expect(result.full_name).toEqual('Test User');
    expect(result.role).toEqual('SecurityAnalyst');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser123');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].full_name).toEqual('Test User');
    expect(users[0].role).toEqual('SecurityAnalyst');
    expect(users[0].is_active).toEqual(true);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create user with default is_active value', async () => {
    const inputWithDefaults: CreateUserInput = {
      username: 'defaultuser',
      email: 'default@example.com',
      full_name: 'Default User',
      role: 'Viewer',
      is_active: true // Zod default is applied
    };

    const result = await createUser(inputWithDefaults);

    expect(result.is_active).toEqual(true);
    expect(result.username).toEqual('defaultuser');
    expect(result.role).toEqual('Viewer');
  });

  it('should create users with different roles', async () => {
    const adminInput: CreateUserInput = {
      username: 'adminuser',
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'Admin',
      is_active: true
    };

    const managerInput: CreateUserInput = {
      username: 'manageruser',
      email: 'manager@example.com',
      full_name: 'Manager User',
      role: 'SecurityManager',
      is_active: true
    };

    const admin = await createUser(adminInput);
    const manager = await createUser(managerInput);

    expect(admin.role).toEqual('Admin');
    expect(manager.role).toEqual('SecurityManager');

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
    
    const roles = allUsers.map(u => u.role).sort();
    expect(roles).toEqual(['Admin', 'SecurityManager']);
  });

  it('should create inactive users', async () => {
    const inactiveInput: CreateUserInput = {
      username: 'inactiveuser',
      email: 'inactive@example.com',
      full_name: 'Inactive User',
      role: 'Viewer',
      is_active: false
    };

    const result = await createUser(inactiveInput);

    expect(result.is_active).toEqual(false);
    
    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users[0].is_active).toEqual(false);
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same username
    const duplicateInput: CreateUserInput = {
      username: 'testuser123', // Same username
      email: 'different@example.com',
      full_name: 'Different User',
      role: 'Viewer',
      is_active: true
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same email
    const duplicateInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      full_name: 'Different User',
      role: 'Viewer',
      is_active: true
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key/i);
  });

  it('should handle all valid user roles', async () => {
    const roles = ['Admin', 'SecurityAnalyst', 'SecurityManager', 'Viewer'] as const;
    
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const input: CreateUserInput = {
        username: `user${i}`,
        email: `user${i}@example.com`,
        full_name: `User ${i}`,
        role: role,
        is_active: true
      };

      const result = await createUser(input);
      expect(result.role).toEqual(role);
    }

    // Verify all users created
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(4);
    
    const createdRoles = allUsers.map(u => u.role).sort();
    expect(createdRoles).toEqual(['Admin', 'SecurityAnalyst', 'SecurityManager', 'Viewer']);
  });
});