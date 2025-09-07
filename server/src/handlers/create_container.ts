import { db } from '../db';
import { containersTable, usersTable } from '../db/schema';
import { type CreateContainerInput, type Container } from '../schema';
import { eq } from 'drizzle-orm';

export const createContainer = async (input: CreateContainerInput): Promise<Container> => {
  try {
    // Verify that the creator user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with ID ${input.created_by} does not exist`);
    }

    // Insert container record
    const result = await db.insert(containersTable)
      .values({
        name: input.name,
        description: input.description,
        type: input.type,
        risk_score: 0, // Initialize default risk score to 0
        external_id: input.external_id,
        external_system: input.external_system,
        created_by: input.created_by,
        is_active: true
      })
      .returning()
      .execute();

    const container = result[0];
    return {
      ...container,
      risk_score: parseFloat(container.risk_score.toString()) // Convert numeric field to number
    };
  } catch (error) {
    console.error('Container creation failed:', error);
    throw error;
  }
};