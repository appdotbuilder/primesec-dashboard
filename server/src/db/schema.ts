import { serial, text, pgTable, timestamp, integer, boolean, pgEnum, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for database
export const severityLevelEnum = pgEnum('severity_level', ['Critical', 'High', 'Medium', 'Low']);
export const issueStatusEnum = pgEnum('issue_status', ['Open', 'In-progress', 'Closed', 'Resolved']);
export const issueClassificationEnum = pgEnum('issue_classification', ['Vulnerability', 'Misconfiguration', 'Weakness', 'Exposure']);
export const containerTypeEnum = pgEnum('container_type', ['Project', 'Application', 'System', 'Service']);
export const issueHierarchyEnum = pgEnum('issue_hierarchy', ['Epic', 'Story', 'Task']);
export const controlStatusEnum = pgEnum('control_status', ['Existing', 'Planned', 'NotSpecified']);
export const violationTypeEnum = pgEnum('violation_type', ['SecurityBreach', 'PolicyViolation', 'ComplianceIssue', 'DataLeak']);
export const userRoleEnum = pgEnum('user_role', ['Admin', 'SecurityAnalyst', 'SecurityManager', 'Viewer']);
export const reviewStatusEnum = pgEnum('review_status', ['Pending', 'InReview', 'Completed', 'Rejected']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_active: boolean('is_active').default(true).notNull()
});

// Containers table (Scopes/Projects)
export const containersTable = pgTable('containers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: containerTypeEnum('type').notNull(),
  risk_score: real('risk_score').default(0).notNull(), // Will be calculated based on issues
  external_id: text('external_id'), // For integration with Jira, Azure DevOps
  external_system: text('external_system'),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_active: boolean('is_active').default(true).notNull()
});

// Security Issues table (Workroom)
export const securityIssuesTable = pgTable('security_issues', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: severityLevelEnum('severity').notNull(),
  status: issueStatusEnum('status').default('Open').notNull(),
  classification: issueClassificationEnum('classification').notNull(),
  hierarchy: issueHierarchyEnum('hierarchy').notNull(),
  risk_score: real('risk_score').default(0).notNull(), // AI-calculated 0-100
  confidentiality_impact: real('confidentiality_impact').default(0).notNull(),
  integrity_impact: real('integrity_impact').default(0).notNull(),
  availability_impact: real('availability_impact').default(0).notNull(),
  compliance_impact: real('compliance_impact').default(0).notNull(),
  third_party_risk: real('third_party_risk').default(0).notNull(),
  mitre_attack_id: text('mitre_attack_id'),
  mitre_attack_tactic: text('mitre_attack_tactic'),
  mitre_attack_technique: text('mitre_attack_technique'),
  linddun_category: text('linddun_category'),
  attack_complexity: text('attack_complexity'),
  threat_modeling_notes: text('threat_modeling_notes'),
  compensating_controls: text('compensating_controls'),
  container_id: integer('container_id').notNull(),
  parent_issue_id: integer('parent_issue_id'), // For Epic/Story/Task hierarchy
  assigned_to: integer('assigned_to'),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_automated_finding: boolean('is_automated_finding').default(false).notNull()
});

// Security Reviews table
export const securityReviewsTable = pgTable('security_reviews', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  document_name: text('document_name'),
  document_url: text('document_url'),
  document_type: text('document_type'), // PDF, DOCX, etc.
  status: reviewStatusEnum('status').default('Pending').notNull(),
  ai_analysis_complete: boolean('ai_analysis_complete').default(false).notNull(),
  ai_analysis_results: text('ai_analysis_results'), // JSON string of AI findings
  container_id: integer('container_id'),
  reviewer_id: integer('reviewer_id'),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Security Violations table
export const securityViolationsTable = pgTable('security_violations', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  violation_type: violationTypeEnum('violation_type').notNull(),
  severity: severityLevelEnum('severity').notNull(),
  status: issueStatusEnum('status').default('Open').notNull(),
  incident_date: timestamp('incident_date').notNull(),
  detection_method: text('detection_method'),
  affected_systems: text('affected_systems'),
  impact_assessment: text('impact_assessment'),
  remediation_steps: text('remediation_steps'),
  container_id: integer('container_id'),
  related_issue_id: integer('related_issue_id'),
  assigned_to: integer('assigned_to'),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Security Controls table (Blueprints)
export const securityControlsTable = pgTable('security_controls', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  control_type: text('control_type').notNull(),
  implementation_status: controlStatusEnum('implementation_status').notNull(),
  effectiveness_rating: real('effectiveness_rating'), // 0-100
  framework_reference: text('framework_reference'), // NIST, ISO, etc.
  control_family: text('control_family'),
  implementation_notes: text('implementation_notes'),
  testing_frequency: text('testing_frequency'),
  last_tested: timestamp('last_tested'),
  container_id: integer('container_id').notNull(),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_active: boolean('is_active').default(true).notNull()
});

// Architecture Components table (Blueprints - System Architecture)
export const architectureComponentsTable = pgTable('architecture_components', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  component_type: text('component_type').notNull(),
  description: text('description'),
  technology_stack: text('technology_stack'),
  security_domain: text('security_domain'),
  trust_boundary: text('trust_boundary'),
  network_zone: text('network_zone'),
  data_classification: text('data_classification'),
  position_x: real('position_x'), // For diagram positioning
  position_y: real('position_y'),
  container_id: integer('container_id').notNull(),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_active: boolean('is_active').default(true).notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdContainers: many(containersTable),
  createdIssues: many(securityIssuesTable, { relationName: 'createdIssues' }),
  assignedIssues: many(securityIssuesTable, { relationName: 'assignedIssues' }),
  createdReviews: many(securityReviewsTable, { relationName: 'createdReviews' }),
  reviewedDocuments: many(securityReviewsTable, { relationName: 'reviewedDocuments' }),
  createdViolations: many(securityViolationsTable, { relationName: 'createdViolations' }),
  assignedViolations: many(securityViolationsTable, { relationName: 'assignedViolations' }),
  createdControls: many(securityControlsTable),
  createdComponents: many(architectureComponentsTable)
}));

export const containersRelations = relations(containersTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [containersTable.created_by],
    references: [usersTable.id]
  }),
  securityIssues: many(securityIssuesTable),
  securityReviews: many(securityReviewsTable),
  securityViolations: many(securityViolationsTable),
  securityControls: many(securityControlsTable),
  architectureComponents: many(architectureComponentsTable)
}));

export const securityIssuesRelations = relations(securityIssuesTable, ({ one, many }) => ({
  container: one(containersTable, {
    fields: [securityIssuesTable.container_id],
    references: [containersTable.id]
  }),
  parentIssue: one(securityIssuesTable, {
    fields: [securityIssuesTable.parent_issue_id],
    references: [securityIssuesTable.id],
    relationName: 'parentChild'
  }),
  childIssues: many(securityIssuesTable, { relationName: 'parentChild' }),
  assignedUser: one(usersTable, {
    fields: [securityIssuesTable.assigned_to],
    references: [usersTable.id],
    relationName: 'assignedIssues'
  }),
  creator: one(usersTable, {
    fields: [securityIssuesTable.created_by],
    references: [usersTable.id],
    relationName: 'createdIssues'
  }),
  relatedViolations: many(securityViolationsTable)
}));

export const securityReviewsRelations = relations(securityReviewsTable, ({ one }) => ({
  container: one(containersTable, {
    fields: [securityReviewsTable.container_id],
    references: [containersTable.id]
  }),
  reviewer: one(usersTable, {
    fields: [securityReviewsTable.reviewer_id],
    references: [usersTable.id],
    relationName: 'reviewedDocuments'
  }),
  creator: one(usersTable, {
    fields: [securityReviewsTable.created_by],
    references: [usersTable.id],
    relationName: 'createdReviews'
  })
}));

export const securityViolationsRelations = relations(securityViolationsTable, ({ one }) => ({
  container: one(containersTable, {
    fields: [securityViolationsTable.container_id],
    references: [containersTable.id]
  }),
  relatedIssue: one(securityIssuesTable, {
    fields: [securityViolationsTable.related_issue_id],
    references: [securityIssuesTable.id]
  }),
  assignedUser: one(usersTable, {
    fields: [securityViolationsTable.assigned_to],
    references: [usersTable.id],
    relationName: 'assignedViolations'
  }),
  creator: one(usersTable, {
    fields: [securityViolationsTable.created_by],
    references: [usersTable.id],
    relationName: 'createdViolations'
  })
}));

export const securityControlsRelations = relations(securityControlsTable, ({ one }) => ({
  container: one(containersTable, {
    fields: [securityControlsTable.container_id],
    references: [containersTable.id]
  }),
  creator: one(usersTable, {
    fields: [securityControlsTable.created_by],
    references: [usersTable.id]
  })
}));

export const architectureComponentsRelations = relations(architectureComponentsTable, ({ one }) => ({
  container: one(containersTable, {
    fields: [architectureComponentsTable.container_id],
    references: [containersTable.id]
  }),
  creator: one(usersTable, {
    fields: [architectureComponentsTable.created_by],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Container = typeof containersTable.$inferSelect;
export type NewContainer = typeof containersTable.$inferInsert;
export type SecurityIssue = typeof securityIssuesTable.$inferSelect;
export type NewSecurityIssue = typeof securityIssuesTable.$inferInsert;
export type SecurityReview = typeof securityReviewsTable.$inferSelect;
export type NewSecurityReview = typeof securityReviewsTable.$inferInsert;
export type SecurityViolation = typeof securityViolationsTable.$inferSelect;
export type NewSecurityViolation = typeof securityViolationsTable.$inferInsert;
export type SecurityControl = typeof securityControlsTable.$inferSelect;
export type NewSecurityControl = typeof securityControlsTable.$inferInsert;
export type ArchitectureComponent = typeof architectureComponentsTable.$inferSelect;
export type NewArchitectureComponent = typeof architectureComponentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  containers: containersTable,
  securityIssues: securityIssuesTable,
  securityReviews: securityReviewsTable,
  securityViolations: securityViolationsTable,
  securityControls: securityControlsTable,
  architectureComponents: architectureComponentsTable
};