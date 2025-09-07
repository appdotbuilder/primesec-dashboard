import { db } from '../db';
import { containersTable, securityIssuesTable } from '../db/schema';
import { type Container } from '../schema';
import { eq, and, avg } from 'drizzle-orm';

export const updateContainerRiskScore = async (containerId: number): Promise<Container> => {
  try {
    // First verify the container exists
    const containers = await db.select()
      .from(containersTable)
      .where(eq(containersTable.id, containerId))
      .execute();

    if (containers.length === 0) {
      throw new Error(`Container with id ${containerId} not found`);
    }

    // Calculate the risk score based on security issues
    const securityIssues = await db.select()
      .from(securityIssuesTable)
      .where(and(
        eq(securityIssuesTable.container_id, containerId),
        eq(securityIssuesTable.status, 'Open') // Only consider open issues for current risk
      ))
      .execute();

    let riskScore = 0;

    if (securityIssues.length > 0) {
      // Calculate weighted risk score based on severity and individual risk scores
      const severityWeights = {
        'Critical': 1.0,
        'High': 0.8,
        'Medium': 0.6,
        'Low': 0.3
      };

      let totalWeightedScore = 0;
      let totalWeight = 0;

      securityIssues.forEach(issue => {
        const weight = severityWeights[issue.severity];
        const issueRiskScore = issue.risk_score; // Risk score is already numeric
        totalWeightedScore += issueRiskScore * weight;
        totalWeight += weight;
      });

      // Calculate average weighted risk score
      riskScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      
      // Cap at 100 and round to 2 decimal places
      riskScore = Math.min(100, Math.round(riskScore * 100) / 100);
    }

    // Update the container's risk score
    const result = await db.update(containersTable)
      .set({ 
        risk_score: riskScore, // Real column is numeric, no string conversion needed
        updated_at: new Date()
      })
      .where(eq(containersTable.id, containerId))
      .returning()
      .execute();

    const updatedContainer = result[0];
    
    // Return the updated container (risk_score is already numeric)
    return updatedContainer;
  } catch (error) {
    console.error('Container risk score update failed:', error);
    throw error;
  }
};