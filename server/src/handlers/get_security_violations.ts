import { db } from '../db';
import { securityViolationsTable, containersTable, usersTable } from '../db/schema';
import { type SecurityViolation } from '../schema';
import { eq, and, gte, lte, desc, or, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

// Input schema for filtering violations
export const getSecurityViolationsInputSchema = z.object({
  violation_type: z.enum(['SecurityBreach', 'PolicyViolation', 'ComplianceIssue', 'DataLeak']).optional(),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  status: z.enum(['Open', 'In-progress', 'Closed', 'Resolved']).optional(),
  assigned_to: z.number().optional(),
  container_id: z.number().optional(),
  created_after: z.coerce.date().optional(),
  created_before: z.coerce.date().optional(),
  incident_after: z.coerce.date().optional(),
  incident_before: z.coerce.date().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  order_by: z.enum(['created_at', 'incident_date', 'severity', 'status']).default('created_at')
});

export type GetSecurityViolationsInput = z.infer<typeof getSecurityViolationsInputSchema>;

export async function getSecurityViolations(input: Partial<GetSecurityViolationsInput> = {}): Promise<SecurityViolation[]> {
  try {
    // Apply defaults for required fields
    const processedInput = getSecurityViolationsInputSchema.parse(input);

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (processedInput.violation_type) {
      conditions.push(eq(securityViolationsTable.violation_type, processedInput.violation_type));
    }

    if (processedInput.severity) {
      conditions.push(eq(securityViolationsTable.severity, processedInput.severity));
    }

    if (processedInput.status) {
      conditions.push(eq(securityViolationsTable.status, processedInput.status));
    }

    if (processedInput.assigned_to) {
      conditions.push(eq(securityViolationsTable.assigned_to, processedInput.assigned_to));
    }

    if (processedInput.container_id) {
      conditions.push(eq(securityViolationsTable.container_id, processedInput.container_id));
    }

    if (processedInput.created_after) {
      conditions.push(gte(securityViolationsTable.created_at, processedInput.created_after));
    }

    if (processedInput.created_before) {
      conditions.push(lte(securityViolationsTable.created_at, processedInput.created_before));
    }

    if (processedInput.incident_after) {
      conditions.push(gte(securityViolationsTable.incident_date, processedInput.incident_after));
    }

    if (processedInput.incident_before) {
      conditions.push(lte(securityViolationsTable.incident_date, processedInput.incident_before));
    }

    // Build the query in a single chain
    const query = db.select()
      .from(securityViolationsTable)
      .$dynamic();

    // Apply conditions
    const conditionalQuery = conditions.length > 0
      ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : query;

    // Apply ordering based on order_by parameter
    let orderedQuery: typeof conditionalQuery;
    
    if (processedInput.order_by === 'incident_date') {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.incident_date));
    } else if (processedInput.order_by === 'severity') {
      // Create custom severity ordering: Critical > High > Medium > Low
      orderedQuery = conditionalQuery.orderBy(
        sql`CASE 
          WHEN ${securityViolationsTable.severity} = 'Critical' THEN 1 
          WHEN ${securityViolationsTable.severity} = 'High' THEN 2 
          WHEN ${securityViolationsTable.severity} = 'Medium' THEN 3 
          WHEN ${securityViolationsTable.severity} = 'Low' THEN 4 
          ELSE 5 
        END ASC`
      );
    } else if (processedInput.order_by === 'status') {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.status));
    } else {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.created_at));
    }

    // Apply pagination and execute
    const results = await orderedQuery
      .limit(processedInput.limit)
      .offset(processedInput.offset)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch security violations:', error);
    throw error;
  }
}

export async function getActiveSecurityViolations(): Promise<SecurityViolation[]> {
  try {
    // Query for open and in-progress violations, ordered by severity then creation date
    const results = await db.select()
      .from(securityViolationsTable)
      .where(
        or(
          eq(securityViolationsTable.status, 'Open'),
          eq(securityViolationsTable.status, 'In-progress')
        )
      )
      .orderBy(
        // Custom severity ordering: Critical > High > Medium > Low
        sql`CASE 
          WHEN ${securityViolationsTable.severity} = 'Critical' THEN 1 
          WHEN ${securityViolationsTable.severity} = 'High' THEN 2 
          WHEN ${securityViolationsTable.severity} = 'Medium' THEN 3 
          WHEN ${securityViolationsTable.severity} = 'Low' THEN 4 
          ELSE 5 
        END ASC`,
        desc(securityViolationsTable.created_at)
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch active security violations:', error);
    throw error;
  }
}

// Helper function to get violations with related data (container, assignee info)
export async function getSecurityViolationsWithDetails(input: Partial<GetSecurityViolationsInput> = {}): Promise<Array<SecurityViolation & { container_name?: string | null; assignee_name?: string | null }>> {
  try {
    // Apply defaults for required fields
    const processedInput = getSecurityViolationsInputSchema.parse(input);

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (processedInput.violation_type) {
      conditions.push(eq(securityViolationsTable.violation_type, processedInput.violation_type));
    }

    if (processedInput.severity) {
      conditions.push(eq(securityViolationsTable.severity, processedInput.severity));
    }

    if (processedInput.status) {
      conditions.push(eq(securityViolationsTable.status, processedInput.status));
    }

    if (processedInput.assigned_to) {
      conditions.push(eq(securityViolationsTable.assigned_to, processedInput.assigned_to));
    }

    if (processedInput.container_id) {
      conditions.push(eq(securityViolationsTable.container_id, processedInput.container_id));
    }

    if (processedInput.created_after) {
      conditions.push(gte(securityViolationsTable.created_at, processedInput.created_after));
    }

    if (processedInput.created_before) {
      conditions.push(lte(securityViolationsTable.created_at, processedInput.created_before));
    }

    if (processedInput.incident_after) {
      conditions.push(gte(securityViolationsTable.incident_date, processedInput.incident_after));
    }

    if (processedInput.incident_before) {
      conditions.push(lte(securityViolationsTable.incident_date, processedInput.incident_before));
    }

    // Build the query with joins in a single chain
    const query = db.select({
      // All violation fields
      id: securityViolationsTable.id,
      title: securityViolationsTable.title,
      description: securityViolationsTable.description,
      violation_type: securityViolationsTable.violation_type,
      severity: securityViolationsTable.severity,
      status: securityViolationsTable.status,
      incident_date: securityViolationsTable.incident_date,
      detection_method: securityViolationsTable.detection_method,
      affected_systems: securityViolationsTable.affected_systems,
      impact_assessment: securityViolationsTable.impact_assessment,
      remediation_steps: securityViolationsTable.remediation_steps,
      container_id: securityViolationsTable.container_id,
      related_issue_id: securityViolationsTable.related_issue_id,
      assigned_to: securityViolationsTable.assigned_to,
      created_by: securityViolationsTable.created_by,
      created_at: securityViolationsTable.created_at,
      updated_at: securityViolationsTable.updated_at,
      // Related data
      container_name: containersTable.name,
      assignee_name: usersTable.full_name
    })
    .from(securityViolationsTable)
    .leftJoin(containersTable, eq(securityViolationsTable.container_id, containersTable.id))
    .leftJoin(usersTable, eq(securityViolationsTable.assigned_to, usersTable.id))
    .$dynamic();

    // Apply conditions
    const conditionalQuery = conditions.length > 0
      ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : query;

    // Apply ordering based on order_by parameter
    let orderedQuery: typeof conditionalQuery;
    
    if (processedInput.order_by === 'incident_date') {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.incident_date));
    } else if (processedInput.order_by === 'severity') {
      // Create custom severity ordering: Critical > High > Medium > Low
      orderedQuery = conditionalQuery.orderBy(
        sql`CASE 
          WHEN ${securityViolationsTable.severity} = 'Critical' THEN 1 
          WHEN ${securityViolationsTable.severity} = 'High' THEN 2 
          WHEN ${securityViolationsTable.severity} = 'Medium' THEN 3 
          WHEN ${securityViolationsTable.severity} = 'Low' THEN 4 
          ELSE 5 
        END ASC`
      );
    } else if (processedInput.order_by === 'status') {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.status));
    } else {
      orderedQuery = conditionalQuery.orderBy(desc(securityViolationsTable.created_at));
    }

    // Apply pagination and execute
    const results = await orderedQuery
      .limit(processedInput.limit)
      .offset(processedInput.offset)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch security violations with details:', error);
    throw error;
  }
}