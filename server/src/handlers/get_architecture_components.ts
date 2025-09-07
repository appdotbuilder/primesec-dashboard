import { db } from '../db';
import { architectureComponentsTable, containersTable } from '../db/schema';
import { type ArchitectureComponent } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';
import { type SQL } from 'drizzle-orm';

export interface GetArchitectureComponentsFilters {
  component_type?: string;
  security_domain?: string;
  container_id?: number;
  trust_boundary?: string;
  network_zone?: string;
  is_active?: boolean;
}

export async function getArchitectureComponents(filters?: GetArchitectureComponentsFilters): Promise<ArchitectureComponent[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters?.component_type) {
      conditions.push(eq(architectureComponentsTable.component_type, filters.component_type));
    }

    if (filters?.security_domain) {
      conditions.push(eq(architectureComponentsTable.security_domain, filters.security_domain));
    }

    if (filters?.container_id !== undefined) {
      conditions.push(eq(architectureComponentsTable.container_id, filters.container_id));
    }

    if (filters?.trust_boundary) {
      conditions.push(eq(architectureComponentsTable.trust_boundary, filters.trust_boundary));
    }

    if (filters?.network_zone) {
      conditions.push(eq(architectureComponentsTable.network_zone, filters.network_zone));
    }

    if (filters?.is_active !== undefined) {
      conditions.push(eq(architectureComponentsTable.is_active, filters.is_active));
    }

    // Build query with or without conditions
    const results = conditions.length > 0
      ? await db.select()
          .from(architectureComponentsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(architectureComponentsTable)
          .execute();

    // Convert numeric fields back to numbers
    return results.map(component => ({
      ...component,
      position_x: component.position_x !== null ? parseFloat(component.position_x.toString()) : null,
      position_y: component.position_y !== null ? parseFloat(component.position_y.toString()) : null
    }));
  } catch (error) {
    console.error('Failed to get architecture components:', error);
    throw error;
  }
}

export async function getArchitectureComponentsByContainer(containerId: number): Promise<ArchitectureComponent[]> {
  try {
    // Validate that container exists
    const containerExists = await db.select({ id: containersTable.id })
      .from(containersTable)
      .where(eq(containersTable.id, containerId))
      .execute();

    if (containerExists.length === 0) {
      throw new Error(`Container with id ${containerId} does not exist`);
    }

    const results = await db.select()
      .from(architectureComponentsTable)
      .where(
        and(
          eq(architectureComponentsTable.container_id, containerId),
          eq(architectureComponentsTable.is_active, true)
        )
      )
      .execute();

    // Convert numeric fields back to numbers
    return results.map(component => ({
      ...component,
      position_x: component.position_x !== null ? parseFloat(component.position_x.toString()) : null,
      position_y: component.position_y !== null ? parseFloat(component.position_y.toString()) : null
    }));
  } catch (error) {
    console.error('Failed to get architecture components by container:', error);
    throw error;
  }
}