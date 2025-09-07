import { db } from '../db';
import { securityControlsTable } from '../db/schema';
import { type SecurityControl } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';


export interface SecurityControlFilters {
  implementation_status?: 'Existing' | 'Planned' | 'NotSpecified';
  control_type?: string;
  framework_reference?: string;
  container_id?: number;
  control_family?: string;
  is_active?: boolean;
}

export async function getSecurityControls(filters?: SecurityControlFilters): Promise<SecurityControl[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters?.implementation_status) {
      conditions.push(eq(securityControlsTable.implementation_status, filters.implementation_status));
    }

    if (filters?.control_type) {
      conditions.push(eq(securityControlsTable.control_type, filters.control_type));
    }

    if (filters?.framework_reference) {
      conditions.push(eq(securityControlsTable.framework_reference, filters.framework_reference));
    }

    if (filters?.container_id !== undefined) {
      conditions.push(eq(securityControlsTable.container_id, filters.container_id));
    }

    if (filters?.control_family) {
      conditions.push(eq(securityControlsTable.control_family, filters.control_family));
    }

    if (filters?.is_active !== undefined) {
      conditions.push(eq(securityControlsTable.is_active, filters.is_active));
    }

    // Build and execute query
    const query = conditions.length > 0
      ? db.select().from(securityControlsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : db.select().from(securityControlsTable);

    const results = await query.execute();

    // Convert numeric fields back to numbers
    return results.map(control => ({
      ...control,
      effectiveness_rating: control.effectiveness_rating ? parseFloat(control.effectiveness_rating.toString()) : null
    }));
  } catch (error) {
    console.error('Failed to fetch security controls:', error);
    throw error;
  }
}

export async function getSecurityControlsByContainer(containerId: number): Promise<SecurityControl[]> {
  try {
    const results = await db.select()
      .from(securityControlsTable)
      .where(eq(securityControlsTable.container_id, containerId))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(control => ({
      ...control,
      effectiveness_rating: control.effectiveness_rating ? parseFloat(control.effectiveness_rating.toString()) : null
    }));
  } catch (error) {
    console.error('Failed to fetch security controls by container:', error);
    throw error;
  }
}