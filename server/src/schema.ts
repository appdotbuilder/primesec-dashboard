import { z } from 'zod';

// Enums for various categorical data
export const SeverityLevel = z.enum(['Critical', 'High', 'Medium', 'Low']);
export const IssueStatus = z.enum(['Open', 'In-progress', 'Closed', 'Resolved']);
export const IssueClassification = z.enum(['Vulnerability', 'Misconfiguration', 'Weakness', 'Exposure']);
export const RiskDimension = z.enum(['Confidentiality', 'Integrity', 'Availability', 'Compliance', 'ThirdParty']);
export const ContainerType = z.enum(['Project', 'Application', 'System', 'Service']);
export const IssueHierarchy = z.enum(['Epic', 'Story', 'Task']);
export const ControlStatus = z.enum(['Existing', 'Planned', 'NotSpecified']);
export const ViolationType = z.enum(['SecurityBreach', 'PolicyViolation', 'ComplianceIssue', 'DataLeak']);
export const UserRole = z.enum(['Admin', 'SecurityAnalyst', 'SecurityManager', 'Viewer']);
export const ReviewStatus = z.enum(['Pending', 'InReview', 'Completed', 'Rejected']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  role: UserRole,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_active: z.boolean()
});

export type User = z.infer<typeof userSchema>;

// Container (Scopes) schema
export const containerSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: ContainerType,
  risk_score: z.number().min(0).max(100),
  external_id: z.string().nullable(), // For Jira, Azure DevOps integration
  external_system: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_active: z.boolean()
});

export type Container = z.infer<typeof containerSchema>;

// Security Issue schema (Workroom)
export const securityIssueSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  severity: SeverityLevel,
  status: IssueStatus,
  classification: IssueClassification,
  hierarchy: IssueHierarchy,
  risk_score: z.number().min(0).max(100),
  confidentiality_impact: z.number().min(0).max(100),
  integrity_impact: z.number().min(0).max(100),
  availability_impact: z.number().min(0).max(100),
  compliance_impact: z.number().min(0).max(100),
  third_party_risk: z.number().min(0).max(100),
  mitre_attack_id: z.string().nullable(),
  mitre_attack_tactic: z.string().nullable(),
  mitre_attack_technique: z.string().nullable(),
  linddun_category: z.string().nullable(),
  attack_complexity: z.string().nullable(),
  threat_modeling_notes: z.string().nullable(),
  compensating_controls: z.string().nullable(),
  container_id: z.number(),
  parent_issue_id: z.number().nullable(), // For Epic/Story/Task hierarchy
  assigned_to: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_automated_finding: z.boolean()
});

export type SecurityIssue = z.infer<typeof securityIssueSchema>;

// Security Review schema
export const securityReviewSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  document_name: z.string().nullable(),
  document_url: z.string().nullable(),
  document_type: z.string().nullable(), // PDF, DOCX, etc.
  status: ReviewStatus,
  ai_analysis_complete: z.boolean(),
  ai_analysis_results: z.string().nullable(), // JSON string of AI findings
  container_id: z.number().nullable(),
  reviewer_id: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SecurityReview = z.infer<typeof securityReviewSchema>;

// Security Violation schema
export const securityViolationSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  violation_type: ViolationType,
  severity: SeverityLevel,
  status: IssueStatus,
  incident_date: z.coerce.date(),
  detection_method: z.string().nullable(),
  affected_systems: z.string().nullable(),
  impact_assessment: z.string().nullable(),
  remediation_steps: z.string().nullable(),
  container_id: z.number().nullable(),
  related_issue_id: z.number().nullable(),
  assigned_to: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SecurityViolation = z.infer<typeof securityViolationSchema>;

// Security Control schema (Blueprints)
export const securityControlSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  control_type: z.string(),
  implementation_status: ControlStatus,
  effectiveness_rating: z.number().min(0).max(100).nullable(),
  framework_reference: z.string().nullable(), // NIST, ISO, etc.
  control_family: z.string().nullable(),
  implementation_notes: z.string().nullable(),
  testing_frequency: z.string().nullable(),
  last_tested: z.coerce.date().nullable(),
  container_id: z.number(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_active: z.boolean()
});

export type SecurityControl = z.infer<typeof securityControlSchema>;

// System Architecture Component schema (Blueprints)
export const architectureComponentSchema = z.object({
  id: z.number(),
  name: z.string(),
  component_type: z.string(),
  description: z.string().nullable(),
  technology_stack: z.string().nullable(),
  security_domain: z.string().nullable(),
  trust_boundary: z.string().nullable(),
  network_zone: z.string().nullable(),
  data_classification: z.string().nullable(),
  position_x: z.number().nullable(), // For diagram positioning
  position_y: z.number().nullable(),
  container_id: z.number(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_active: z.boolean()
});

export type ArchitectureComponent = z.infer<typeof architectureComponentSchema>;

// Input schemas for creating records
export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  full_name: z.string().min(1).max(100),
  role: UserRole,
  is_active: z.boolean().default(true)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createContainerInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  type: ContainerType,
  external_id: z.string().nullable(),
  external_system: z.string().nullable(),
  created_by: z.number()
});

export type CreateContainerInput = z.infer<typeof createContainerInputSchema>;

export const createSecurityIssueInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  severity: SeverityLevel,
  classification: IssueClassification,
  hierarchy: IssueHierarchy,
  confidentiality_impact: z.number().min(0).max(100).default(0),
  integrity_impact: z.number().min(0).max(100).default(0),
  availability_impact: z.number().min(0).max(100).default(0),
  compliance_impact: z.number().min(0).max(100).default(0),
  third_party_risk: z.number().min(0).max(100).default(0),
  mitre_attack_id: z.string().nullable(),
  mitre_attack_tactic: z.string().nullable(),
  mitre_attack_technique: z.string().nullable(),
  linddun_category: z.string().nullable(),
  attack_complexity: z.string().nullable(),
  threat_modeling_notes: z.string().nullable(),
  compensating_controls: z.string().nullable(),
  container_id: z.number(),
  parent_issue_id: z.number().nullable(),
  assigned_to: z.number().nullable(),
  created_by: z.number(),
  is_automated_finding: z.boolean().default(false)
});

export type CreateSecurityIssueInput = z.infer<typeof createSecurityIssueInputSchema>;

export const createSecurityReviewInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  document_name: z.string().nullable(),
  document_url: z.string().nullable(),
  document_type: z.string().nullable(),
  container_id: z.number().nullable(),
  created_by: z.number()
});

export type CreateSecurityReviewInput = z.infer<typeof createSecurityReviewInputSchema>;

export const createSecurityViolationInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  violation_type: ViolationType,
  severity: SeverityLevel,
  incident_date: z.coerce.date(),
  detection_method: z.string().nullable(),
  affected_systems: z.string().nullable(),
  impact_assessment: z.string().nullable(),
  remediation_steps: z.string().nullable(),
  container_id: z.number().nullable(),
  related_issue_id: z.number().nullable(),
  assigned_to: z.number().nullable(),
  created_by: z.number()
});

export type CreateSecurityViolationInput = z.infer<typeof createSecurityViolationInputSchema>;

export const createSecurityControlInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  control_type: z.string().min(1).max(50),
  implementation_status: ControlStatus,
  effectiveness_rating: z.number().min(0).max(100).nullable(),
  framework_reference: z.string().nullable(),
  control_family: z.string().nullable(),
  implementation_notes: z.string().nullable(),
  testing_frequency: z.string().nullable(),
  last_tested: z.coerce.date().nullable(),
  container_id: z.number(),
  created_by: z.number()
});

export type CreateSecurityControlInput = z.infer<typeof createSecurityControlInputSchema>;

export const createArchitectureComponentInputSchema = z.object({
  name: z.string().min(1).max(100),
  component_type: z.string().min(1).max(50),
  description: z.string().nullable(),
  technology_stack: z.string().nullable(),
  security_domain: z.string().nullable(),
  trust_boundary: z.string().nullable(),
  network_zone: z.string().nullable(),
  data_classification: z.string().nullable(),
  position_x: z.number().nullable(),
  position_y: z.number().nullable(),
  container_id: z.number(),
  created_by: z.number()
});

export type CreateArchitectureComponentInput = z.infer<typeof createArchitectureComponentInputSchema>;

// Update schemas for partial updates
export const updateSecurityIssueInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  severity: SeverityLevel.optional(),
  status: IssueStatus.optional(),
  classification: IssueClassification.optional(),
  confidentiality_impact: z.number().min(0).max(100).optional(),
  integrity_impact: z.number().min(0).max(100).optional(),
  availability_impact: z.number().min(0).max(100).optional(),
  compliance_impact: z.number().min(0).max(100).optional(),
  third_party_risk: z.number().min(0).max(100).optional(),
  mitre_attack_id: z.string().nullable().optional(),
  mitre_attack_tactic: z.string().nullable().optional(),
  mitre_attack_technique: z.string().nullable().optional(),
  linddun_category: z.string().nullable().optional(),
  attack_complexity: z.string().nullable().optional(),
  threat_modeling_notes: z.string().nullable().optional(),
  compensating_controls: z.string().nullable().optional(),
  assigned_to: z.number().nullable().optional()
});

export type UpdateSecurityIssueInput = z.infer<typeof updateSecurityIssueInputSchema>;

// Analytics and filtering schemas
export const securityIssueFilterSchema = z.object({
  container_id: z.number().optional(),
  severity: SeverityLevel.optional(),
  status: IssueStatus.optional(),
  classification: IssueClassification.optional(),
  assigned_to: z.number().optional(),
  is_automated_finding: z.boolean().optional(),
  created_after: z.coerce.date().optional(),
  created_before: z.coerce.date().optional(),
  risk_score_min: z.number().min(0).max(100).optional(),
  risk_score_max: z.number().min(0).max(100).optional()
});

export type SecurityIssueFilter = z.infer<typeof securityIssueFilterSchema>;

export const dashboardAnalyticsSchema = z.object({
  total_issues: z.number(),
  critical_issues: z.number(),
  high_issues: z.number(),
  medium_issues: z.number(),
  low_issues: z.number(),
  open_issues: z.number(),
  resolved_issues: z.number(),
  average_risk_score: z.number(),
  top_risk_containers: z.array(z.object({
    container_id: z.number(),
    container_name: z.string(),
    risk_score: z.number(),
    issue_count: z.number()
  })),
  recent_violations: z.array(z.object({
    id: z.number(),
    title: z.string(),
    severity: SeverityLevel,
    created_at: z.coerce.date()
  })),
  control_coverage: z.object({
    existing: z.number(),
    planned: z.number(),
    not_specified: z.number()
  })
});

export type DashboardAnalytics = z.infer<typeof dashboardAnalyticsSchema>;