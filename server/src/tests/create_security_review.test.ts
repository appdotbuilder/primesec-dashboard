import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { securityReviewsTable, usersTable, containersTable } from '../db/schema';
import { type CreateSecurityReviewInput } from '../schema';
import { createSecurityReview } from '../handlers/create_security_review';
import { eq } from 'drizzle-orm';

describe('createSecurityReview', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'SecurityAnalyst',
        is_active: true
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create a test container
  const createTestContainer = async (createdBy: number) => {
    const result = await db.insert(containersTable)
      .values({
        name: 'Test Container',
        description: 'A container for testing',
        type: 'Project',
        created_by: createdBy
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should create a security review with all fields', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);

    const testInput: CreateSecurityReviewInput = {
      title: 'Security Architecture Review',
      description: 'Review of system security architecture',
      document_name: 'security_arch.pdf',
      document_url: 'https://example.com/docs/security_arch.pdf',
      document_type: 'PDF',
      container_id: container.id,
      created_by: user.id
    };

    const result = await createSecurityReview(testInput);

    // Verify all fields are correctly set
    expect(result.title).toEqual('Security Architecture Review');
    expect(result.description).toEqual('Review of system security architecture');
    expect(result.document_name).toEqual('security_arch.pdf');
    expect(result.document_url).toEqual('https://example.com/docs/security_arch.pdf');
    expect(result.document_type).toEqual('PDF');
    expect(result.container_id).toEqual(container.id);
    expect(result.created_by).toEqual(user.id);
    expect(result.status).toEqual('Pending');
    expect(result.ai_analysis_complete).toEqual(false);
    expect(result.ai_analysis_results).toBeNull();
    expect(result.reviewer_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a security review with minimal fields', async () => {
    const user = await createTestUser();

    const testInput: CreateSecurityReviewInput = {
      title: 'Basic Review',
      description: null,
      document_name: null,
      document_url: null,
      document_type: null,
      container_id: null,
      created_by: user.id
    };

    const result = await createSecurityReview(testInput);

    expect(result.title).toEqual('Basic Review');
    expect(result.description).toBeNull();
    expect(result.document_name).toBeNull();
    expect(result.document_url).toBeNull();
    expect(result.document_type).toBeNull();
    expect(result.container_id).toBeNull();
    expect(result.created_by).toEqual(user.id);
    expect(result.status).toEqual('Pending');
    expect(result.ai_analysis_complete).toEqual(false);
    expect(result.id).toBeDefined();
  });

  it('should save security review to database', async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);

    const testInput: CreateSecurityReviewInput = {
      title: 'Database Test Review',
      description: 'Testing database persistence',
      document_name: 'test.docx',
      document_url: 'https://example.com/test.docx',
      document_type: 'DOCX',
      container_id: container.id,
      created_by: user.id
    };

    const result = await createSecurityReview(testInput);

    // Query database to verify persistence
    const reviews = await db.select()
      .from(securityReviewsTable)
      .where(eq(securityReviewsTable.id, result.id))
      .execute();

    expect(reviews).toHaveLength(1);
    expect(reviews[0].title).toEqual('Database Test Review');
    expect(reviews[0].description).toEqual('Testing database persistence');
    expect(reviews[0].document_name).toEqual('test.docx');
    expect(reviews[0].document_url).toEqual('https://example.com/test.docx');
    expect(reviews[0].document_type).toEqual('DOCX');
    expect(reviews[0].container_id).toEqual(container.id);
    expect(reviews[0].created_by).toEqual(user.id);
    expect(reviews[0].status).toEqual('Pending');
    expect(reviews[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when creator does not exist', async () => {
    const testInput: CreateSecurityReviewInput = {
      title: 'Invalid User Review',
      description: 'This should fail',
      document_name: null,
      document_url: null,
      document_type: null,
      container_id: null,
      created_by: 999 // Non-existent user ID
    };

    expect(createSecurityReview(testInput)).rejects.toThrow(/User with id 999 does not exist/i);
  });

  it('should throw error when container does not exist', async () => {
    const user = await createTestUser();

    const testInput: CreateSecurityReviewInput = {
      title: 'Invalid Container Review',
      description: 'This should fail',
      document_name: null,
      document_url: null,
      document_type: null,
      container_id: 999, // Non-existent container ID
      created_by: user.id
    };

    expect(createSecurityReview(testInput)).rejects.toThrow(/Container with id 999 does not exist/i);
  });

  it('should handle different document types correctly', async () => {
    const user = await createTestUser();

    const documentTypes = ['PDF', 'DOCX', 'TXT', 'MD'];

    for (const docType of documentTypes) {
      const testInput: CreateSecurityReviewInput = {
        title: `Review for ${docType}`,
        description: `Testing ${docType} document type`,
        document_name: `test.${docType.toLowerCase()}`,
        document_url: `https://example.com/test.${docType.toLowerCase()}`,
        document_type: docType,
        container_id: null,
        created_by: user.id
      };

      const result = await createSecurityReview(testInput);
      expect(result.document_type).toEqual(docType);
      expect(result.title).toEqual(`Review for ${docType}`);
    }
  });

  it('should set default values correctly', async () => {
    const user = await createTestUser();

    const testInput: CreateSecurityReviewInput = {
      title: 'Default Values Test',
      description: 'Testing default field values',
      document_name: null,
      document_url: null,
      document_type: null,
      container_id: null,
      created_by: user.id
    };

    const result = await createSecurityReview(testInput);

    // Verify default values
    expect(result.status).toEqual('Pending');
    expect(result.ai_analysis_complete).toEqual(false);
    expect(result.ai_analysis_results).toBeNull();
    expect(result.reviewer_id).toBeNull();
    
    // Verify timestamps are set
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify created_at and updated_at are close in time (within 1 second)
    const timeDiff = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDiff).toBeLessThan(1000);
  });
});