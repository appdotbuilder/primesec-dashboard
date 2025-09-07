import { db } from '../db';
import { securityIssuesTable, containersTable } from '../db/schema';
import { type UpdateSecurityIssueInput, type SecurityIssue } from '../schema';
import { eq, avg } from 'drizzle-orm';

// Calculate overall risk score based on impact dimensions
const calculateRiskScore = (
  confidentiality: number,
  integrity: number,
  availability: number,
  compliance: number,
  thirdParty: number
): number => {
  // Weighted average with CIA triad getting higher weight
  const ciaWeight = 0.25; // 25% each for C, I, A
  const complianceWeight = 0.15; // 15% for compliance
  const thirdPartyWeight = 0.1; // 10% for third party

  const riskScore = 
    (confidentiality * ciaWeight) +
    (integrity * ciaWeight) +
    (availability * ciaWeight) +
    (compliance * complianceWeight) +
    (thirdParty * thirdPartyWeight);

  return Math.round(riskScore * 100) / 100; // Round to 2 decimal places
};

// Update container risk score based on average of all issues
const updateContainerRiskScore = async (containerId: number): Promise<void> => {
  try {
    const result = await db.select({ avgRisk: avg(securityIssuesTable.risk_score) })
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.container_id, containerId))
      .execute();

    const averageRiskScore = result[0]?.avgRisk || 0;
    const roundedRiskScore = Math.round(Number(averageRiskScore) * 100) / 100;

    await db.update(containersTable)
      .set({ 
        risk_score: roundedRiskScore,
        updated_at: new Date()
      })
      .where(eq(containersTable.id, containerId))
      .execute();
  } catch (error) {
    console.error('Container risk score update failed:', error);
    // Don't throw - container risk update failure shouldn't block issue update
  }
};

export const updateSecurityIssue = async (input: UpdateSecurityIssueInput): Promise<SecurityIssue> => {
  try {
    // First, get the current issue to check what's changing
    const currentIssue = await db.select()
      .from(securityIssuesTable)
      .where(eq(securityIssuesTable.id, input.id))
      .execute();

    if (currentIssue.length === 0) {
      throw new Error(`Security issue with id ${input.id} not found`);
    }

    const current = currentIssue[0];

    // Prepare update values with only provided fields
    const updateValues: any = {
      updated_at: new Date()
    };

    // Copy provided fields to update values
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.severity !== undefined) updateValues.severity = input.severity;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.classification !== undefined) updateValues.classification = input.classification;
    if (input.assigned_to !== undefined) updateValues.assigned_to = input.assigned_to;
    if (input.mitre_attack_id !== undefined) updateValues.mitre_attack_id = input.mitre_attack_id;
    if (input.mitre_attack_tactic !== undefined) updateValues.mitre_attack_tactic = input.mitre_attack_tactic;
    if (input.mitre_attack_technique !== undefined) updateValues.mitre_attack_technique = input.mitre_attack_technique;
    if (input.linddun_category !== undefined) updateValues.linddun_category = input.linddun_category;
    if (input.attack_complexity !== undefined) updateValues.attack_complexity = input.attack_complexity;
    if (input.threat_modeling_notes !== undefined) updateValues.threat_modeling_notes = input.threat_modeling_notes;
    if (input.compensating_controls !== undefined) updateValues.compensating_controls = input.compensating_controls;

    // Handle impact dimensions and recalculate risk score if any impact changed
    const impactChanged = 
      input.confidentiality_impact !== undefined ||
      input.integrity_impact !== undefined ||
      input.availability_impact !== undefined ||
      input.compliance_impact !== undefined ||
      input.third_party_risk !== undefined;

    if (impactChanged) {
      // Use provided values or current values for calculation
      const confidentiality = input.confidentiality_impact !== undefined 
        ? input.confidentiality_impact 
        : current.confidentiality_impact;
      
      const integrity = input.integrity_impact !== undefined 
        ? input.integrity_impact 
        : current.integrity_impact;
      
      const availability = input.availability_impact !== undefined 
        ? input.availability_impact 
        : current.availability_impact;
      
      const compliance = input.compliance_impact !== undefined 
        ? input.compliance_impact 
        : current.compliance_impact;
      
      const thirdParty = input.third_party_risk !== undefined 
        ? input.third_party_risk 
        : current.third_party_risk;

      // Set impact values in update
      if (input.confidentiality_impact !== undefined) updateValues.confidentiality_impact = input.confidentiality_impact;
      if (input.integrity_impact !== undefined) updateValues.integrity_impact = input.integrity_impact;
      if (input.availability_impact !== undefined) updateValues.availability_impact = input.availability_impact;
      if (input.compliance_impact !== undefined) updateValues.compliance_impact = input.compliance_impact;
      if (input.third_party_risk !== undefined) updateValues.third_party_risk = input.third_party_risk;

      // Calculate and set new risk score
      const newRiskScore = calculateRiskScore(confidentiality, integrity, availability, compliance, thirdParty);
      updateValues.risk_score = newRiskScore;
    }

    // Update the security issue
    const result = await db.update(securityIssuesTable)
      .set(updateValues)
      .where(eq(securityIssuesTable.id, input.id))
      .returning()
      .execute();

    const updatedIssue = result[0];

    // If risk score changed, update container risk score
    if (impactChanged) {
      await updateContainerRiskScore(updatedIssue.container_id);
    }

    // Return with proper numeric types
    return {
      ...updatedIssue,
      risk_score: updatedIssue.risk_score,
      confidentiality_impact: updatedIssue.confidentiality_impact,
      integrity_impact: updatedIssue.integrity_impact,
      availability_impact: updatedIssue.availability_impact,
      compliance_impact: updatedIssue.compliance_impact,
      third_party_risk: updatedIssue.third_party_risk
    };
  } catch (error) {
    console.error('Security issue update failed:', error);
    throw error;
  }
};