import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, UserRole } from '../schema';
import { eq, and, desc, SQL } from 'drizzle-orm';
import { z } from 'zod';

// Input schema for filtering users
export const getUsersInputSchema = z.object({
  role: UserRole.optional(),
  is_active: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

export type GetUsersInput = z.infer<typeof getUsersInputSchema>;

export const getUsers = async (inputRaw: Partial<GetUsersInput> = {}): Promise<User[]> => {
  try {
    // Parse input with Zod defaults
    const input = getUsersInputSchema.parse(inputRaw);

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (input.role !== undefined) {
      conditions.push(eq(usersTable.role, input.role));
    }

    if (input.is_active !== undefined) {
      conditions.push(eq(usersTable.is_active, input.is_active));
    }

    // Build the query in one go to avoid type issues
    const baseQuery = db.select().from(usersTable);
    
    const queryWithConditions = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const results = await queryWithConditions
      .orderBy(desc(usersTable.created_at))
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};