import { db } from '../db';
import { securityIssuesTable, containersTable } from '../db/schema';
import { type CreateSecurityIssueInput, type SecurityIssue } from '../schema';
import { eq, avg } from 'drizzle-orm';

export const createSecurityIssue = async (input: CreateSecurityIssueInput): Promise<SecurityIssue> => {
  try {
    // Calculate overall risk score from individual dimension impacts
    const calculateRiskScore = (
      confidentiality: number,
      integrity: number,
      availability: number,
      compliance: number,
      thirdParty: number
    ): number => {
      // Weighted risk calculation based on security impact dimensions
      // Critical dimensions get higher weights
      const weights = {
        confidentiality: 0.25,
        integrity: 0.25, 
        availability: 0.20,
        compliance: 0.15,
        thirdParty: 0.15
      };

      const weightedScore = 
        (confidentiality * weights.confidentiality) +
        (integrity * weights.integrity) +
        (availability * weights.availability) +
        (compliance * weights.compliance) +
        (thirdParty * weights.thirdParty);

      return Math.round(weightedScore);
    };

    const riskScore = calculateRiskScore(
      input.confidentiality_impact,
      input.integrity_impact,
      input.availability_impact,
      input.compliance_impact,
      input.third_party_risk
    );

    // Insert security issue
    const result = await db.insert(securityIssuesTable)
      .values({
        title: input.title,
        description: input.description,
        severity: input.severity,
        classification: input.classification,
        hierarchy: input.hierarchy,
        risk_score: riskScore, // Real column accepts number directly
        confidentiality_impact: input.confidentiality_impact,
        integrity_impact: input.integrity_impact,
        availability_impact: input.availability_impact,
        compliance_impact: input.compliance_impact,
        third_party_risk: input.third_party_risk,
        mitre_attack_id: input.mitre_attack_id,
        mitre_attack_tactic: input.mitre_attack_tactic,
        mitre_attack_technique: input.mitre_attack_technique,
        linddun_category: input.linddun_category,
        attack_complexity: input.attack_complexity,
        threat_modeling_notes: input.threat_modeling_notes,
        compensating_controls: input.compensating_controls,
        container_id: input.container_id,
        parent_issue_id: input.parent_issue_id,
        assigned_to: input.assigned_to,
        created_by: input.created_by,
        is_automated_finding: input.is_automated_finding
      })
      .returning()
      .execute();

    const securityIssue = result[0];

    // Update container risk score based on average of all issues
    const avgRiskResult = await db.select({
      avg_risk: avg(securityIssuesTable.risk_score)
    })
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, input.container_id))
      .execute();

    const avgRisk = Number(avgRiskResult[0].avg_risk || 0);

    await db.update(containersTable)
      .set({
        risk_score: avgRisk,
        updated_at: new Date()
      })
      .where(eq(containersTable.id, input.container_id))
      .execute();

    // Return the security issue (numeric fields are already numbers from real columns)
    return securityIssue;
  } catch (error) {
    console.error('Security issue creation failed:', error);
    throw error;
  }
};