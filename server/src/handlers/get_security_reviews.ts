import { db } from '../db';
import { securityReviewsTable } from '../db/schema';
import { type SecurityReview } from '../schema';
import { eq, and, isNull, SQL } from 'drizzle-orm';

export interface SecurityReviewFilters {
  container_id?: number;
  status?: 'Pending' | 'InReview' | 'Completed' | 'Rejected';
  reviewer_id?: number;
  ai_analysis_complete?: boolean;
  created_by?: number;
}

export async function getSecurityReviews(filters?: SecurityReviewFilters): Promise<SecurityReview[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters?.container_id !== undefined) {
      conditions.push(eq(securityReviewsTable.container_id, filters.container_id));
    }

    if (filters?.status) {
      conditions.push(eq(securityReviewsTable.status, filters.status));
    }

    if (filters?.reviewer_id !== undefined) {
      conditions.push(eq(securityReviewsTable.reviewer_id, filters.reviewer_id));
    }

    if (filters?.ai_analysis_complete !== undefined) {
      conditions.push(eq(securityReviewsTable.ai_analysis_complete, filters.ai_analysis_complete));
    }

    if (filters?.created_by !== undefined) {
      conditions.push(eq(securityReviewsTable.created_by, filters.created_by));
    }

    // Build query with conditions
    const query = conditions.length > 0
      ? db.select().from(securityReviewsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : db.select().from(securityReviewsTable);

    const results = await query.execute();

    // Return results with proper type conversion for dates
    return results.map(review => ({
      ...review,
      created_at: new Date(review.created_at),
      updated_at: new Date(review.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch security reviews:', error);
    throw error;
  }
}

export async function getSecurityReviewsByContainer(containerId: number): Promise<SecurityReview[]> {
  try {
    const results = await db.select()
      .from(securityReviewsTable)
      .where(eq(securityReviewsTable.container_id, containerId))
      .execute();

    // Return results with proper type conversion for dates
    return results.map(review => ({
      ...review,
      created_at: new Date(review.created_at),
      updated_at: new Date(review.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch security reviews by container:', error);
    throw error;
  }
}

export async function getSecurityReviewById(id: number): Promise<SecurityReview | null> {
  try {
    const results = await db.select()
      .from(securityReviewsTable)
      .where(eq(securityReviewsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const review = results[0];
    return {
      ...review,
      created_at: new Date(review.created_at),
      updated_at: new Date(review.updated_at)
    };
  } catch (error) {
    console.error('Failed to fetch security review by ID:', error);
    throw error;
  }
}