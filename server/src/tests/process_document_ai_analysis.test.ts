import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { securityReviewsTable, usersTable, containersTable } from '../db/schema';
import { type CreateUserInput, type CreateContainerInput, type CreateSecurityReviewInput } from '../schema';
import { processDocumentAiAnalysis, type AIAnalysisResults } from '../handlers/process_document_ai_analysis';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser: CreateUserInput = {
  username: 'aianalyst',
  email: 'analyst@security.com',
  full_name: 'AI Security Analyst',
  role: 'SecurityAnalyst',
  is_active: true
};

const testContainer: CreateContainerInput = {
  name: 'Security Analysis Project',
  description: 'Project for AI analysis testing',
  type: 'Project',
  external_id: null,
  external_system: null,
  created_by: 1 // Will be set after user creation
};

const testArchitectureReview: CreateSecurityReviewInput = {
  title: 'System Architecture Security Review',
  description: 'Comprehensive review of system architecture for security compliance',
  document_name: 'architecture_review.pdf',
  document_url: 'https://docs.example.com/architecture_review.pdf',
  document_type: 'PDF',
  container_id: 1, // Will be set after container creation
  created_by: 1 // Will be set after user creation
};

const testGeneralReview: CreateSecurityReviewInput = {
  title: 'General Security Policy Review',
  description: 'Review of general security policies and procedures',
  document_name: 'security_policy.docx',
  document_url: 'https://docs.example.com/security_policy.docx',
  document_type: 'DOCX',
  container_id: 1,
  created_by: 1
};

describe('processDocumentAiAnalysis', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should process AI analysis for architecture review document', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const containerResult = await db.insert(containersTable)
      .values({
        ...testContainer,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewResult = await db.insert(securityReviewsTable)
      .values({
        ...testArchitectureReview,
        container_id: containerResult[0].id,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewId = reviewResult[0].id;

    // Process AI analysis
    const result = await processDocumentAiAnalysis(reviewId);

    // Verify basic fields
    expect(result.id).toEqual(reviewId);
    expect(result.status).toEqual('Completed');
    expect(result.ai_analysis_complete).toBe(true);
    expect(result.ai_analysis_results).toBeDefined();
    expect(result.updated_at).toBeInstanceOf(Date);

    // Parse and verify AI analysis results structure
    const analysisResults: AIAnalysisResults = JSON.parse(result.ai_analysis_results!);
    
    expect(analysisResults.recommendations).toBeDefined();
    expect(Array.isArray(analysisResults.recommendations)).toBe(true);
    expect(analysisResults.recommendations.length).toBeGreaterThan(0);
    
    expect(analysisResults.risks_identified).toBeDefined();
    expect(Array.isArray(analysisResults.risks_identified)).toBe(true);
    expect(analysisResults.risks_identified.length).toBeGreaterThan(0);
    
    expect(analysisResults.compliance_gaps).toBeDefined();
    expect(Array.isArray(analysisResults.compliance_gaps)).toBe(true);
    
    expect(analysisResults.architecture_concerns).toBeDefined();
    expect(Array.isArray(analysisResults.architecture_concerns)).toBe(true);
    
    expect(analysisResults.overall_security_score).toBeDefined();
    expect(typeof analysisResults.overall_security_score).toBe('number');
    expect(analysisResults.overall_security_score).toBeGreaterThanOrEqual(0);
    expect(analysisResults.overall_security_score).toBeLessThanOrEqual(100);
    
    expect(analysisResults.document_classification).toBeDefined();
    expect(analysisResults.key_findings_summary).toBeDefined();
    expect(analysisResults.next_steps).toBeDefined();
    expect(Array.isArray(analysisResults.next_steps)).toBe(true);
  });

  it('should generate architecture-specific analysis for PDF documents', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const containerResult = await db.insert(containersTable)
      .values({
        ...testContainer,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewResult = await db.insert(securityReviewsTable)
      .values({
        ...testArchitectureReview,
        container_id: containerResult[0].id,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const result = await processDocumentAiAnalysis(reviewResult[0].id);
    const analysisResults: AIAnalysisResults = JSON.parse(result.ai_analysis_results!);

    // Verify architecture-specific content
    expect(analysisResults.document_classification).toEqual('Architecture Review');
    expect(analysisResults.architecture_concerns.length).toBeGreaterThan(0);
    expect(analysisResults.overall_security_score).toBeGreaterThan(60);
    
    // Verify recommendation structure
    const firstRecommendation = analysisResults.recommendations[0];
    expect(firstRecommendation.title).toBeDefined();
    expect(firstRecommendation.description).toBeDefined();
    expect(firstRecommendation.severity).toMatch(/^(Critical|High|Medium|Low)$/);
    expect(firstRecommendation.priority).toBeDefined();
    expect(firstRecommendation.implementation_effort).toMatch(/^(Low|Medium|High)$/);
    expect(firstRecommendation.category).toBeDefined();
    
    // Verify risk structure
    const firstRisk = analysisResults.risks_identified[0];
    expect(firstRisk.risk_name).toBeDefined();
    expect(firstRisk.description).toBeDefined();
    expect(firstRisk.likelihood).toMatch(/^(Very Low|Low|Medium|High|Very High)$/);
    expect(firstRisk.impact).toMatch(/^(Very Low|Low|Medium|High|Very High)$/);
    expect(typeof firstRisk.risk_score).toBe('number');
    expect(firstRisk.risk_score).toBeGreaterThanOrEqual(0);
    expect(firstRisk.risk_score).toBeLessThanOrEqual(100);
    expect(firstRisk.mitigation_strategy).toBeDefined();
  });

  it('should generate general analysis for non-architecture documents', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const containerResult = await db.insert(containersTable)
      .values({
        ...testContainer,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewResult = await db.insert(securityReviewsTable)
      .values({
        ...testGeneralReview,
        container_id: containerResult[0].id,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const result = await processDocumentAiAnalysis(reviewResult[0].id);
    const analysisResults: AIAnalysisResults = JSON.parse(result.ai_analysis_results!);

    // Verify general analysis characteristics
    expect(analysisResults.document_classification).toEqual('General');
    expect(analysisResults.architecture_concerns.length).toEqual(0);
    expect(analysisResults.compliance_gaps.length).toEqual(0);
    expect(analysisResults.overall_security_score).toBeLessThanOrEqual(70);
    
    // Should still have recommendations and risks
    expect(analysisResults.recommendations.length).toBeGreaterThan(0);
    expect(analysisResults.risks_identified.length).toBeGreaterThan(0);
  });

  it('should update database record correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const containerResult = await db.insert(containersTable)
      .values({
        ...testContainer,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewResult = await db.insert(securityReviewsTable)
      .values({
        ...testArchitectureReview,
        container_id: containerResult[0].id,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const originalReview = reviewResult[0];
    expect(originalReview.status).toEqual('Pending');
    expect(originalReview.ai_analysis_complete).toBe(false);
    expect(originalReview.ai_analysis_results).toBeNull();

    // Process AI analysis
    await processDocumentAiAnalysis(originalReview.id);

    // Verify database was updated
    const updatedReviews = await db.select()
      .from(securityReviewsTable)
      .where(eq(securityReviewsTable.id, originalReview.id))
      .execute();

    expect(updatedReviews).toHaveLength(1);
    const updatedReview = updatedReviews[0];

    expect(updatedReview.status).toEqual('Completed');
    expect(updatedReview.ai_analysis_complete).toBe(true);
    expect(updatedReview.ai_analysis_results).not.toBeNull();
    expect(updatedReview.updated_at > originalReview.updated_at).toBe(true);
  });

  it('should handle compliance gap analysis correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const containerResult = await db.insert(containersTable)
      .values({
        ...testContainer,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const reviewResult = await db.insert(securityReviewsTable)
      .values({
        ...testArchitectureReview,
        container_id: containerResult[0].id,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const result = await processDocumentAiAnalysis(reviewResult[0].id);
    const analysisResults: AIAnalysisResults = JSON.parse(result.ai_analysis_results!);

    // Verify compliance gaps structure (if present)
    if (analysisResults.compliance_gaps.length > 0) {
      const firstGap = analysisResults.compliance_gaps[0];
      expect(firstGap.framework).toBeDefined();
      expect(firstGap.control_id).toBeDefined();
      expect(firstGap.gap_description).toBeDefined();
      expect(firstGap.current_state).toBeDefined();
      expect(firstGap.target_state).toBeDefined();
      expect(firstGap.remediation_timeline).toBeDefined();
    }

    // Verify architecture concerns structure (if present)
    if (analysisResults.architecture_concerns.length > 0) {
      const firstConcern = analysisResults.architecture_concerns[0];
      expect(firstConcern.component).toBeDefined();
      expect(firstConcern.concern_type).toMatch(/^(Security|Performance|Scalability|Reliability)$/);
      expect(firstConcern.description).toBeDefined();
      expect(firstConcern.recommended_action).toBeDefined();
      expect(firstConcern.impact_assessment).toBeDefined();
    }
  });

  it('should throw error for non-existent security review', async () => {
    const nonExistentId = 99999;

    await expect(processDocumentAiAnalysis(nonExistentId))
      .rejects
      .toThrow(/Security review with ID 99999 not found/);
  });

  it('should handle reviews without container or document metadata', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create minimal review without container
    const minimalReview = await db.insert(securityReviewsTable)
      .values({
        title: 'Minimal Review',
        description: null,
        document_name: null,
        document_url: null,
        document_type: null,
        container_id: null,
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const result = await processDocumentAiAnalysis(minimalReview[0].id);
    
    expect(result.status).toEqual('Completed');
    expect(result.ai_analysis_complete).toBe(true);
    
    const analysisResults: AIAnalysisResults = JSON.parse(result.ai_analysis_results!);
    expect(analysisResults.document_classification).toEqual('General');
    expect(analysisResults.overall_security_score).toBeDefined();
  });
});