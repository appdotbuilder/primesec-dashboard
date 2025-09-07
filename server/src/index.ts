import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createUserInputSchema,
  createContainerInputSchema,
  createSecurityIssueInputSchema,
  updateSecurityIssueInputSchema,
  createSecurityReviewInputSchema,
  createSecurityViolationInputSchema,
  createSecurityControlInputSchema,
  createArchitectureComponentInputSchema,
  securityIssueFilterSchema
} from './schema';

// Import all handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createContainer } from './handlers/create_container';
import { getContainers } from './handlers/get_containers';
import { updateContainerRiskScore } from './handlers/update_container_risk_score';
import { createSecurityIssue } from './handlers/create_security_issue';
import { getSecurityIssues, getSecurityIssuesByContainer } from './handlers/get_security_issues';
import { updateSecurityIssue } from './handlers/update_security_issue';
import { createSecurityReview } from './handlers/create_security_review';
import { getSecurityReviews, getSecurityReviewsByContainer } from './handlers/get_security_reviews';
import { processDocumentAiAnalysis } from './handlers/process_document_ai_analysis';
import { createSecurityViolation } from './handlers/create_security_violation';
import { getSecurityViolations, getActiveSecurityViolations } from './handlers/get_security_violations';
import { createSecurityControl } from './handlers/create_security_control';
import { getSecurityControls, getSecurityControlsByContainer } from './handlers/get_security_controls';
import { createArchitectureComponent } from './handlers/create_architecture_component';
import { getArchitectureComponents, getArchitectureComponentsByContainer } from './handlers/get_architecture_components';
import { getDashboardAnalytics, getContainerRiskAnalytics } from './handlers/get_dashboard_analytics';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Container management (Scopes)
  createContainer: publicProcedure
    .input(createContainerInputSchema)
    .mutation(({ input }) => createContainer(input)),
  getContainers: publicProcedure
    .query(() => getContainers()),
  updateContainerRiskScore: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .mutation(({ input }) => updateContainerRiskScore(input.containerId)),

  // Security Issues (Workroom)
  createSecurityIssue: publicProcedure
    .input(createSecurityIssueInputSchema)
    .mutation(({ input }) => createSecurityIssue(input)),
  getSecurityIssues: publicProcedure
    .input(securityIssueFilterSchema.optional())
    .query(({ input }) => getSecurityIssues(input)),
  getSecurityIssuesByContainer: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .query(({ input }) => getSecurityIssuesByContainer(input.containerId)),
  updateSecurityIssue: publicProcedure
    .input(updateSecurityIssueInputSchema)
    .mutation(({ input }) => updateSecurityIssue(input)),

  // Security Reviews
  createSecurityReview: publicProcedure
    .input(createSecurityReviewInputSchema)
    .mutation(({ input }) => createSecurityReview(input)),
  getSecurityReviews: publicProcedure
    .query(() => getSecurityReviews()),
  getSecurityReviewsByContainer: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .query(({ input }) => getSecurityReviewsByContainer(input.containerId)),
  processDocumentAiAnalysis: publicProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(({ input }) => processDocumentAiAnalysis(input.reviewId)),

  // Security Violations
  createSecurityViolation: publicProcedure
    .input(createSecurityViolationInputSchema)
    .mutation(({ input }) => createSecurityViolation(input)),
  getSecurityViolations: publicProcedure
    .query(() => getSecurityViolations()),
  getActiveSecurityViolations: publicProcedure
    .query(() => getActiveSecurityViolations()),

  // Security Controls (Blueprints)
  createSecurityControl: publicProcedure
    .input(createSecurityControlInputSchema)
    .mutation(({ input }) => createSecurityControl(input)),
  getSecurityControls: publicProcedure
    .query(() => getSecurityControls()),
  getSecurityControlsByContainer: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .query(({ input }) => getSecurityControlsByContainer(input.containerId)),

  // Architecture Components (Blueprints)
  createArchitectureComponent: publicProcedure
    .input(createArchitectureComponentInputSchema)
    .mutation(({ input }) => createArchitectureComponent(input)),
  getArchitectureComponents: publicProcedure
    .query(() => getArchitectureComponents()),
  getArchitectureComponentsByContainer: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .query(({ input }) => getArchitectureComponentsByContainer(input.containerId)),

  // Analytics Dashboard
  getDashboardAnalytics: publicProcedure
    .query(() => getDashboardAnalytics()),
  getContainerRiskAnalytics: publicProcedure
    .input(z.object({ containerId: z.number() }))
    .query(({ input }) => getContainerRiskAnalytics(input.containerId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`PrimeSec Security Dashboard TRPC server listening at port: ${port}`);
}

start();