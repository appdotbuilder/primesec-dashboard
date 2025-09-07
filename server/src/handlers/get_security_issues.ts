import { db } from '../db';
import { securityIssuesTable } from '../db/schema';
import { type SecurityIssue, type SecurityIssueFilter } from '../schema';
import { eq, gte, lte, and, desc, type SQL } from 'drizzle-orm';

export async function getSecurityIssues(filter?: SecurityIssueFilter): Promise<SecurityIssue[]> {
  try {
    // Build filter conditions
    const conditions: SQL<unknown>[] = [];

    if (filter) {
      // Container filter
      if (filter.container_id !== undefined) {
        conditions.push(eq(securityIssuesTable.container_id, filter.container_id));
      }

      // Severity filter
      if (filter.severity) {
        conditions.push(eq(securityIssuesTable.severity, filter.severity));
      }

      // Status filter
      if (filter.status) {
        conditions.push(eq(securityIssuesTable.status, filter.status));
      }

      // Classification filter
      if (filter.classification) {
        conditions.push(eq(securityIssuesTable.classification, filter.classification));
      }

      // Assigned user filter
      if (filter.assigned_to !== undefined) {
        conditions.push(eq(securityIssuesTable.assigned_to, filter.assigned_to));
      }

      // Automated finding filter
      if (filter.is_automated_finding !== undefined) {
        conditions.push(eq(securityIssuesTable.is_automated_finding, filter.is_automated_finding));
      }

      // Date range filters
      if (filter.created_after) {
        conditions.push(gte(securityIssuesTable.created_at, filter.created_after));
      }

      if (filter.created_before) {
        conditions.push(lte(securityIssuesTable.created_at, filter.created_before));
      }

      // Risk score range filters
      if (filter.risk_score_min !== undefined) {
        conditions.push(gte(securityIssuesTable.risk_score, filter.risk_score_min));
      }

      if (filter.risk_score_max !== undefined) {
        conditions.push(lte(securityIssuesTable.risk_score, filter.risk_score_max));
      }
    }

    // Build final query with all conditions and ordering
    const baseQuery = db.select().from(securityIssuesTable);
    
    const finalQuery = conditions.length > 0 
      ? baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(securityIssuesTable.risk_score), desc(securityIssuesTable.created_at))
      : baseQuery
          .orderBy(desc(securityIssuesTable.risk_score), desc(securityIssuesTable.created_at));

    const results = await finalQuery.execute();

    // Convert real/numeric fields back to numbers
    return results.map(issue => ({
      ...issue,
      risk_score: parseFloat(issue.risk_score.toString()),
      confidentiality_impact: parseFloat(issue.confidentiality_impact.toString()),
      integrity_impact: parseFloat(issue.integrity_impact.toString()),
      availability_impact: parseFloat(issue.availability_impact.toString()),
      compliance_impact: parseFloat(issue.compliance_impact.toString()),
      third_party_risk: parseFloat(issue.third_party_risk.toString())
    }));
  } catch (error) {
    console.error('Failed to get security issues:', error);
    throw error;
  }
}

export async function getSecurityIssuesByContainer(containerId: number): Promise<SecurityIssue[]> {
  try {
    // Get all issues for the container, ordered by hierarchy and risk score
    const results = await db.select()
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, containerId))
      .orderBy(
        desc(securityIssuesTable.hierarchy), // Epic, Story, Task order
        desc(securityIssuesTable.risk_score),
        desc(securityIssuesTable.created_at)
      )
      .execute();

    // Convert real/numeric fields back to numbers
    return results.map(issue => ({
      ...issue,
      risk_score: parseFloat(issue.risk_score.toString()),
      confidentiality_impact: parseFloat(issue.confidentiality_impact.toString()),
      integrity_impact: parseFloat(issue.integrity_impact.toString()),
      availability_impact: parseFloat(issue.availability_impact.toString()),
      compliance_impact: parseFloat(issue.compliance_impact.toString()),
      third_party_risk: parseFloat(issue.third_party_risk.toString())
    }));
  } catch (error) {
    console.error('Failed to get security issues by container:', error);
    throw error;
  }
}