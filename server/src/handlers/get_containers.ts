import { db } from '../db';
import { containersTable, securityIssuesTable } from '../db/schema';
import { type Container } from '../schema';
import { avg, count, eq, sql } from 'drizzle-orm';

export const getContainers = async (): Promise<Container[]> => {
  try {
    // Query containers with calculated risk scores based on their security issues
    const results = await db
      .select({
        id: containersTable.id,
        name: containersTable.name,
        description: containersTable.description,
        type: containersTable.type,
        risk_score: containersTable.risk_score,
        external_id: containersTable.external_id,
        external_system: containersTable.external_system,
        created_by: containersTable.created_by,
        created_at: containersTable.created_at,
        updated_at: containersTable.updated_at,
        is_active: containersTable.is_active,
        // Calculate actual risk score from related security issues
        calculated_risk_score: sql<string>`COALESCE(AVG(${securityIssuesTable.risk_score}), 0)`,
        issue_count: sql<string>`COUNT(${securityIssuesTable.id})`
      })
      .from(containersTable)
      .leftJoin(securityIssuesTable, eq(containersTable.id, securityIssuesTable.container_id))
      .where(eq(containersTable.is_active, true))
      .groupBy(
        containersTable.id,
        containersTable.name,
        containersTable.description,
        containersTable.type,
        containersTable.risk_score,
        containersTable.external_id,
        containersTable.external_system,
        containersTable.created_by,
        containersTable.created_at,
        containersTable.updated_at,
        containersTable.is_active
      )
      .execute();

    // Convert results and handle numeric conversions
    return results.map(result => ({
      id: result.id,
      name: result.name,
      description: result.description,
      type: result.type,
      risk_score: parseFloat(result.calculated_risk_score) || 0, // Use calculated risk score
      external_id: result.external_id,
      external_system: result.external_system,
      created_by: result.created_by,
      created_at: result.created_at,
      updated_at: result.updated_at,
      is_active: result.is_active
    }));
  } catch (error) {
    console.error('Failed to fetch containers:', error);
    throw error;
  }
};