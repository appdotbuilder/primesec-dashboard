import { db } from '../db';
import { securityReviewsTable, usersTable, containersTable } from '../db/schema';
import { type CreateSecurityReviewInput, type SecurityReview } from '../schema';
import { eq } from 'drizzle-orm';

export const createSecurityReview = async (input: CreateSecurityReviewInput): Promise<SecurityReview> => {
  try {
    // Verify that the creator exists
    const creator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (creator.length === 0) {
      throw new Error(`User with id ${input.created_by} does not exist`);
    }

    // Verify container exists if provided
    if (input.container_id) {
      const container = await db.select()
        .from(containersTable)
        .where(eq(containersTable.id, input.container_id))
        .execute();

      if (container.length === 0) {
        throw new Error(`Container with id ${input.container_id} does not exist`);
      }
    }

    // Insert security review record
    const result = await db.insert(securityReviewsTable)
      .values({
        title: input.title,
        description: input.description,
        document_name: input.document_name,
        document_url: input.document_url,
        document_type: input.document_type,
        container_id: input.container_id,
        created_by: input.created_by,
        status: 'Pending', // Default status
        ai_analysis_complete: false, // Default value
        ai_analysis_results: null, // Default value
        reviewer_id: null // Default value
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Security review creation failed:', error);
    throw error;
  }
};