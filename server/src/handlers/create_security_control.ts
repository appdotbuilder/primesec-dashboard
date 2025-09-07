import { db } from '../db';
import { securityControlsTable, containersTable, usersTable } from '../db/schema';
import { type CreateSecurityControlInput, type SecurityControl } from '../schema';
import { eq } from 'drizzle-orm';

export const createSecurityControl = async (input: CreateSecurityControlInput): Promise<SecurityControl> => {
  try {
    // Verify that the container exists
    const container = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, input.container_id))
      .execute();

    if (container.length === 0) {
      throw new Error(`Container with id ${input.container_id} not found`);
    }

    // Verify that the creating user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.created_by} not found`);
    }

    // Insert security control record
    const result = await db.insert(securityControlsTable)
      .values({
        name: input.name,
        description: input.description,
        control_type: input.control_type,
        implementation_status: input.implementation_status,
        effectiveness_rating: input.effectiveness_rating,
        framework_reference: input.framework_reference,
        control_family: input.control_family,
        implementation_notes: input.implementation_notes,
        testing_frequency: input.testing_frequency,
        last_tested: input.last_tested,
        container_id: input.container_id,
        created_by: input.created_by
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const securityControl = result[0];
    return {
      ...securityControl,
      effectiveness_rating: securityControl.effectiveness_rating !== null ? parseFloat(securityControl.effectiveness_rating.toString()) : null
    };
  } catch (error) {
    console.error('Security control creation failed:', error);
    throw error;
  }
};