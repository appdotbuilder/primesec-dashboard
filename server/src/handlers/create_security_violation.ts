import { db } from '../db';
import { securityViolationsTable, usersTable, containersTable, securityIssuesTable } from '../db/schema';
import { type CreateSecurityViolationInput, type SecurityViolation } from '../schema';
import { eq } from 'drizzle-orm';

export const createSecurityViolation = async (input: CreateSecurityViolationInput): Promise<SecurityViolation> => {
  try {
    // Validate that created_by user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with ID ${input.created_by} does not exist`);
    }

    // Validate container exists if provided
    if (input.container_id !== null && input.container_id !== undefined) {
      const containerExists = await db.select()
        .from(containersTable)
        .where(eq(containersTable.id, input.container_id))
        .execute();

      if (containerExists.length === 0) {
        throw new Error(`Container with ID ${input.container_id} does not exist`);
      }
    }

    // Validate related issue exists if provided
    if (input.related_issue_id !== null && input.related_issue_id !== undefined) {
      const issueExists = await db.select()
        .from(securityIssuesTable)
        .where(eq(securityIssuesTable.id, input.related_issue_id))
        .execute();

      if (issueExists.length === 0) {
        throw new Error(`Security issue with ID ${input.related_issue_id} does not exist`);
      }
    }

    // Validate assigned_to user exists if provided
    if (input.assigned_to !== null && input.assigned_to !== undefined) {
      const assignedUserExists = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.assigned_to))
        .execute();

      if (assignedUserExists.length === 0) {
        throw new Error(`Assigned user with ID ${input.assigned_to} does not exist`);
      }
    }

    // Insert security violation record
    const result = await db.insert(securityViolationsTable)
      .values({
        title: input.title,
        description: input.description,
        violation_type: input.violation_type,
        severity: input.severity,
        status: 'Open', // Default status
        incident_date: input.incident_date,
        detection_method: input.detection_method,
        affected_systems: input.affected_systems,
        impact_assessment: input.impact_assessment,
        remediation_steps: input.remediation_steps,
        container_id: input.container_id,
        related_issue_id: input.related_issue_id,
        assigned_to: input.assigned_to,
        created_by: input.created_by
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Security violation creation failed:', error);
    throw error;
  }
};