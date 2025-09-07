import { db } from '../db';
import { 
  securityIssuesTable, 
  containersTable, 
  securityViolationsTable, 
  securityControlsTable 
} from '../db/schema';
import { type DashboardAnalytics } from '../schema';
import { count, eq, desc, gte, avg, sql } from 'drizzle-orm';

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  try {
    // Calculate total issues and severity breakdown
    const issueStatsQuery = db
      .select({
        total: count(),
        severity: securityIssuesTable.severity
      })
      .from(securityIssuesTable)
      .groupBy(securityIssuesTable.severity);

    const issueStats = await issueStatsQuery.execute();

    // Calculate status breakdown
    const statusStatsQuery = db
      .select({
        total: count(),
        status: securityIssuesTable.status
      })
      .from(securityIssuesTable)
      .groupBy(securityIssuesTable.status);

    const statusStats = await statusStatsQuery.execute();

    // Calculate average risk score
    const avgRiskQuery = db
      .select({
        avg_risk: avg(securityIssuesTable.risk_score)
      })
      .from(securityIssuesTable);

    const avgRiskResult = await avgRiskQuery.execute();

    // Get top risk containers (containers with highest average risk scores from their issues)
    const topRiskContainersQuery = db
      .select({
        container_id: containersTable.id,
        container_name: containersTable.name,
        avg_risk_score: avg(securityIssuesTable.risk_score),
        issue_count: count(securityIssuesTable.id)
      })
      .from(containersTable)
      .innerJoin(securityIssuesTable, eq(containersTable.id, securityIssuesTable.container_id))
      .groupBy(containersTable.id, containersTable.name)
      .orderBy(desc(avg(securityIssuesTable.risk_score)))
      .limit(5);

    const topRiskContainers = await topRiskContainersQuery.execute();

    // Get recent violations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentViolationsQuery = db
      .select({
        id: securityViolationsTable.id,
        title: securityViolationsTable.title,
        severity: securityViolationsTable.severity,
        created_at: securityViolationsTable.created_at
      })
      .from(securityViolationsTable)
      .where(gte(securityViolationsTable.incident_date, thirtyDaysAgo))
      .orderBy(desc(securityViolationsTable.created_at))
      .limit(10);

    const recentViolations = await recentViolationsQuery.execute();

    // Calculate control coverage statistics
    const controlCoverageQuery = db
      .select({
        total: count(),
        implementation_status: securityControlsTable.implementation_status
      })
      .from(securityControlsTable)
      .where(eq(securityControlsTable.is_active, true))
      .groupBy(securityControlsTable.implementation_status);

    const controlCoverage = await controlCoverageQuery.execute();

    // Process results
    const severityBreakdown = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };

    const statusBreakdown = {
      Open: 0,
      'In-progress': 0,
      Closed: 0,
      Resolved: 0
    };

    const controlBreakdown = {
      existing: 0,
      planned: 0,
      not_specified: 0
    };

    // Process severity stats
    issueStats.forEach(stat => {
      severityBreakdown[stat.severity as keyof typeof severityBreakdown] = stat.total;
    });

    // Process status stats
    statusStats.forEach(stat => {
      statusBreakdown[stat.status as keyof typeof statusBreakdown] = stat.total;
    });

    // Process control coverage
    controlCoverage.forEach(coverage => {
      if (coverage.implementation_status === 'Existing') {
        controlBreakdown.existing = coverage.total;
      } else if (coverage.implementation_status === 'Planned') {
        controlBreakdown.planned = coverage.total;
      } else if (coverage.implementation_status === 'NotSpecified') {
        controlBreakdown.not_specified = coverage.total;
      }
    });

    const totalIssues = Object.values(severityBreakdown).reduce((sum, count) => sum + count, 0);
    const averageRiskScore = avgRiskResult[0]?.avg_risk ? parseFloat(avgRiskResult[0].avg_risk.toString()) : 0;

    return {
      total_issues: totalIssues,
      critical_issues: severityBreakdown.Critical,
      high_issues: severityBreakdown.High,
      medium_issues: severityBreakdown.Medium,
      low_issues: severityBreakdown.Low,
      open_issues: statusBreakdown.Open + statusBreakdown['In-progress'],
      resolved_issues: statusBreakdown.Closed + statusBreakdown.Resolved,
      average_risk_score: averageRiskScore,
      top_risk_containers: topRiskContainers.map(container => ({
        container_id: container.container_id,
        container_name: container.container_name,
        risk_score: parseFloat(container.avg_risk_score?.toString() || '0'),
        issue_count: container.issue_count
      })),
      recent_violations: recentViolations,
      control_coverage: controlBreakdown
    };
  } catch (error) {
    console.error('Dashboard analytics calculation failed:', error);
    throw error;
  }
}

export async function getContainerRiskAnalytics(containerId: number): Promise<{
  container_risk_score: number;
  issue_breakdown: Record<string, number>;
  risk_trends: Array<{ date: Date; score: number }>;
  top_issues: Array<{ id: number; title: string; risk_score: number }>;
}> {
  try {
    // Calculate container's average risk score
    const containerRiskQuery = db
      .select({
        avg_risk: avg(securityIssuesTable.risk_score)
      })
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, containerId));

    const containerRisk = await containerRiskQuery.execute();

    // Get issue breakdown by severity
    const issueBreakdownQuery = db
      .select({
        count: count(),
        severity: securityIssuesTable.severity
      })
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, containerId))
      .groupBy(securityIssuesTable.severity);

    const issueBreakdown = await issueBreakdownQuery.execute();

    // Get risk trends (daily average risk scores for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const riskTrendsQuery = db
      .select({
        date: sql<Date>`date_trunc('day', ${securityIssuesTable.created_at})::date`,
        avg_risk: avg(securityIssuesTable.risk_score)
      })
      .from(securityIssuesTable)
      .where(
        eq(securityIssuesTable.container_id, containerId)
      )
      .groupBy(sql`date_trunc('day', ${securityIssuesTable.created_at})::date`)
      .orderBy(sql`date_trunc('day', ${securityIssuesTable.created_at})::date`);

    const riskTrends = await riskTrendsQuery.execute();

    // Get top high-risk issues for this container
    const topIssuesQuery = db
      .select({
        id: securityIssuesTable.id,
        title: securityIssuesTable.title,
        risk_score: securityIssuesTable.risk_score
      })
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, containerId))
      .orderBy(desc(securityIssuesTable.risk_score))
      .limit(10);

    const topIssues = await topIssuesQuery.execute();

    // Process results
    const breakdown: Record<string, number> = {};
    issueBreakdown.forEach(item => {
      breakdown[item.severity] = item.count;
    });

    const containerRiskScore = containerRisk[0]?.avg_risk ? parseFloat(containerRisk[0].avg_risk.toString()) : 0;

    return {
      container_risk_score: containerRiskScore,
      issue_breakdown: breakdown,
      risk_trends: riskTrends.map(trend => ({
        date: trend.date,
        score: parseFloat(trend.avg_risk?.toString() || '0')
      })),
      top_issues: topIssues.map(issue => ({
        id: issue.id,
        title: issue.title,
        risk_score: parseFloat(issue.risk_score.toString())
      }))
    };
  } catch (error) {
    console.error('Container risk analytics calculation failed:', error);
    throw error;
  }
}