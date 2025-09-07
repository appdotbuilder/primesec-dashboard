import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers, type GetUsersInput, getUsersInputSchema } from '../handlers/get_users';
import { eq } from 'drizzle-orm';

// Test user data
const testUsers: CreateUserInput[] = [
  {
    username: 'admin_user',
    email: 'admin@example.com',
    full_name: 'Admin User',
    role: 'Admin',
    is_active: true
  },
  {
    username: 'analyst_user',
    email: 'analyst@example.com',
    full_name: 'Security Analyst',
    role: 'SecurityAnalyst',
    is_active: true
  },
  {
    username: 'manager_user',
    email: 'manager@example.com',
    full_name: 'Security Manager',
    role: 'SecurityManager',
    is_active: true
  },
  {
    username: 'viewer_user',
    email: 'viewer@example.com',
    full_name: 'View Only User',
    role: 'Viewer',
    is_active: false
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test users
  const createTestUsers = async () => {
    const results = [];
    for (const userData of testUsers) {
      const result = await db.insert(usersTable)
        .values({
          username: userData.username,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          is_active: userData.is_active
        })
        .returning()
        .execute();
      results.push(result[0]);
    }
    return results;
  };

  it('should fetch all users without filters', async () => {
    await createTestUsers();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    expect(result[0].username).toBeDefined();
    expect(result[0].email).toBeDefined();
    expect(result[0].full_name).toBeDefined();
    expect(result[0].role).toBeDefined();
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should filter users by role', async () => {
    await createTestUsers();

    const input = {
      role: 'Admin' as const
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].role).toEqual('Admin');
    expect(result[0].username).toEqual('admin_user');
  });

  it('should filter users by active status', async () => {
    await createTestUsers();

    const input = {
      is_active: true
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(3);
    result.forEach(user => {
      expect(user.is_active).toBe(true);
    });
  });

  it('should filter users by inactive status', async () => {
    await createTestUsers();

    const input = {
      is_active: false
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].is_active).toBe(false);
    expect(result[0].username).toEqual('viewer_user');
  });

  it('should combine role and active status filters', async () => {
    await createTestUsers();

    const input = {
      role: 'SecurityAnalyst' as const,
      is_active: true
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].role).toEqual('SecurityAnalyst');
    expect(result[0].is_active).toBe(true);
    expect(result[0].username).toEqual('analyst_user');
  });

  it('should return empty array when no users match filters', async () => {
    await createTestUsers();

    const input = {
      role: 'Admin' as const,
      is_active: false
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(0);
  });

  it('should apply pagination correctly', async () => {
    await createTestUsers();

    const input = {
      limit: 2,
      offset: 0
    };

    const result = await getUsers(input);

    expect(result).toHaveLength(2);
  });

  it('should apply offset pagination correctly', async () => {
    await createTestUsers();

    // Get first page
    const firstPage = await getUsers({
      limit: 2,
      offset: 0
    });

    // Get second page
    const secondPage = await getUsers({
      limit: 2,
      offset: 2
    });

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);
    
    // Verify different users on different pages
    const firstPageIds = firstPage.map(u => u.id);
    const secondPageIds = secondPage.map(u => u.id);
    
    firstPageIds.forEach(id => {
      expect(secondPageIds).not.toContain(id);
    });
  });

  it('should order users by creation date descending', async () => {
    const createdUsers = await createTestUsers();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    
    // Verify ordering - most recent first
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at.getTime()).toBeGreaterThanOrEqual(
        result[i + 1].created_at.getTime()
      );
    }
  });

  it('should use default pagination values', async () => {
    await createTestUsers();

    const result = await getUsers({});

    // Should return all users with default limit (50) and offset (0)
    expect(result).toHaveLength(4);
  });

  it('should save users to database correctly', async () => {
    const createdUsers = await createTestUsers();

    // Verify all users exist in database
    const dbUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(dbUsers).toHaveLength(4);

    // Verify specific user data
    const adminUser = dbUsers.find(u => u.role === 'Admin');
    expect(adminUser).toBeDefined();
    expect(adminUser?.username).toEqual('admin_user');
    expect(adminUser?.email).toEqual('admin@example.com');
    expect(adminUser?.is_active).toBe(true);
  });
});