import { db } from '../db';
import { architectureComponentsTable, containersTable, usersTable } from '../db/schema';
import { type CreateArchitectureComponentInput, type ArchitectureComponent } from '../schema';
import { eq } from 'drizzle-orm';

export const createArchitectureComponent = async (input: CreateArchitectureComponentInput): Promise<ArchitectureComponent> => {
  try {
    // Verify container exists and is active
    const container = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, input.container_id))
      .execute();

    if (container.length === 0 || !container[0].is_active) {
      throw new Error(`Container with ID ${input.container_id} not found or inactive`);
    }

    // Verify creator exists and is active
    const creator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (creator.length === 0 || !creator[0].is_active) {
      throw new Error(`User with ID ${input.created_by} not found or inactive`);
    }

    // Insert architecture component record
    const result = await db.insert(architectureComponentsTable)
      .values({
        name: input.name,
        component_type: input.component_type,
        description: input.description,
        technology_stack: input.technology_stack,
        security_domain: input.security_domain,
        trust_boundary: input.trust_boundary,
        network_zone: input.network_zone,
        data_classification: input.data_classification,
        position_x: input.position_x,
        position_y: input.position_y,
        container_id: input.container_id,
        created_by: input.created_by
      })
      .returning()
      .execute();

    // Convert real fields back to numbers before returning
    const component = result[0];
    return {
      ...component,
      position_x: component.position_x ? parseFloat(component.position_x.toString()) : null,
      position_y: component.position_y ? parseFloat(component.position_y.toString()) : null
    };
  } catch (error) {
    console.error('Architecture component creation failed:', error);
    throw error;
  }
};