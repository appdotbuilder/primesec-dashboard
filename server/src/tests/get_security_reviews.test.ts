import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, containersTable, securityReviewsTable } from '../db/schema';
import { getSecurityReviews, getSecurityReviewsByContainer, getSecurityReviewById } from '../handlers/get_security_reviews';
import { type CreateUserInput, type CreateContainerInput, type CreateSecurityReviewInput } from '../schema';

// Test data setup
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'SecurityAnalyst',
  is_active: true
};

const testReviewer: CreateUserInput = {
  username: 'reviewer',
  email: 'reviewer@example.com',
  full_name: 'Test Reviewer',
  role: 'SecurityManager',
  is_active: true
};

const testContainer: CreateContainerInput = {
  name: 'Test Container',
  description: 'Container for testing',
  type: 'Project',
  external_id: null,
  external_system: null,
  created_by: 1 // Will be set after user creation
};

const testReview1: CreateSecurityReviewInput = {
  title: 'Security Architecture Review',
  description: 'Review of system architecture',
  document_name: 'arch_review.pdf',
  document_url: 'https://example.com/arch_review.pdf',
  document_type: 'PDF',
  container_id: 1, // Will be set after container creation
  created_by: 1 // Will be set after user creation
};

const testReview2: CreateSecurityReviewInput = {
  title: 'Code Security Review',
  description: 'Review of application code',
  document_name: null,
  document_url: null,
  document_type: null,
  container_id: 1, // Will be set after container creation
  created_by: 1 // Will be set after user creation
};

describe('getSecurityReviews', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no reviews exist', async () => {
    const reviews = await getSecurityReviews();
    expect(reviews).toEqual([]);
  });

  it('should fetch all security reviews', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create test reviews
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId
      },
      {
        ...testReview2,
        container_id: containerId,
        created_by: userId
      }
    ]).execute();

    const reviews = await getSecurityReviews();

    expect(reviews).toHaveLength(2);
    expect(reviews[0].title).toEqual('Security Architecture Review');
    expect(reviews[0].description).toEqual('Review of system architecture');
    expect(reviews[0].document_name).toEqual('arch_review.pdf');
    expect(reviews[0].status).toEqual('Pending');
    expect(reviews[0].ai_analysis_complete).toEqual(false);
    expect(reviews[0].container_id).toEqual(containerId);
    expect(reviews[0].created_by).toEqual(userId);
    expect(reviews[0].created_at).toBeInstanceOf(Date);
    expect(reviews[0].updated_at).toBeInstanceOf(Date);

    expect(reviews[1].title).toEqual('Code Security Review');
    expect(reviews[1].document_name).toBeNull();
    expect(reviews[1].document_url).toBeNull();
  });

  it('should filter reviews by container_id', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const container1Result = await db.insert(containersTable).values({
      ...testContainer,
      name: 'Container 1',
      created_by: userId
    }).returning().execute();
    const container1Id = container1Result[0].id;

    const container2Result = await db.insert(containersTable).values({
      ...testContainer,
      name: 'Container 2',
      created_by: userId
    }).returning().execute();
    const container2Id = container2Result[0].id;

    // Create reviews for different containers
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: container1Id,
        created_by: userId
      },
      {
        ...testReview2,
        container_id: container2Id,
        created_by: userId
      }
    ]).execute();

    const reviewsContainer1 = await getSecurityReviews({ container_id: container1Id });
    const reviewsContainer2 = await getSecurityReviews({ container_id: container2Id });

    expect(reviewsContainer1).toHaveLength(1);
    expect(reviewsContainer1[0].container_id).toEqual(container1Id);
    expect(reviewsContainer1[0].title).toEqual('Security Architecture Review');

    expect(reviewsContainer2).toHaveLength(1);
    expect(reviewsContainer2[0].container_id).toEqual(container2Id);
    expect(reviewsContainer2[0].title).toEqual('Code Security Review');
  });

  it('should filter reviews by status', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create reviews with different statuses
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId,
        status: 'Pending'
      },
      {
        ...testReview2,
        title: 'Completed Review',
        container_id: containerId,
        created_by: userId,
        status: 'Completed'
      }
    ]).execute();

    const pendingReviews = await getSecurityReviews({ status: 'Pending' });
    const completedReviews = await getSecurityReviews({ status: 'Completed' });

    expect(pendingReviews).toHaveLength(1);
    expect(pendingReviews[0].status).toEqual('Pending');
    expect(pendingReviews[0].title).toEqual('Security Architecture Review');

    expect(completedReviews).toHaveLength(1);
    expect(completedReviews[0].status).toEqual('Completed');
    expect(completedReviews[0].title).toEqual('Completed Review');
  });

  it('should filter reviews by AI analysis completion', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create reviews with different AI analysis states
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId,
        ai_analysis_complete: false
      },
      {
        ...testReview2,
        title: 'AI Analyzed Review',
        container_id: containerId,
        created_by: userId,
        ai_analysis_complete: true,
        ai_analysis_results: '{"findings": ["XSS vulnerability", "SQL injection risk"]}'
      }
    ]).execute();

    const nonAnalyzedReviews = await getSecurityReviews({ ai_analysis_complete: false });
    const analyzedReviews = await getSecurityReviews({ ai_analysis_complete: true });

    expect(nonAnalyzedReviews).toHaveLength(1);
    expect(nonAnalyzedReviews[0].ai_analysis_complete).toEqual(false);
    expect(nonAnalyzedReviews[0].ai_analysis_results).toBeNull();

    expect(analyzedReviews).toHaveLength(1);
    expect(analyzedReviews[0].ai_analysis_complete).toEqual(true);
    expect(analyzedReviews[0].ai_analysis_results).toEqual('{"findings": ["XSS vulnerability", "SQL injection risk"]}');
  });

  it('should filter reviews by reviewer', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const reviewerResult = await db.insert(usersTable).values(testReviewer).returning().execute();
    const reviewerId = reviewerResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create reviews with different reviewers
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId,
        reviewer_id: reviewerId
      },
      {
        ...testReview2,
        container_id: containerId,
        created_by: userId,
        reviewer_id: null
      }
    ]).execute();

    const reviewsByReviewer = await getSecurityReviews({ reviewer_id: reviewerId });

    expect(reviewsByReviewer).toHaveLength(1);
    expect(reviewsByReviewer[0].reviewer_id).toEqual(reviewerId);
  });

  it('should apply multiple filters simultaneously', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const reviewerResult = await db.insert(usersTable).values(testReviewer).returning().execute();
    const reviewerId = reviewerResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create reviews with various properties
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId,
        reviewer_id: reviewerId,
        status: 'InReview',
        ai_analysis_complete: true
      },
      {
        ...testReview2,
        container_id: containerId,
        created_by: userId,
        reviewer_id: reviewerId,
        status: 'Pending',
        ai_analysis_complete: false
      }
    ]).execute();

    const filteredReviews = await getSecurityReviews({
      container_id: containerId,
      reviewer_id: reviewerId,
      status: 'InReview',
      ai_analysis_complete: true
    });

    expect(filteredReviews).toHaveLength(1);
    expect(filteredReviews[0].container_id).toEqual(containerId);
    expect(filteredReviews[0].reviewer_id).toEqual(reviewerId);
    expect(filteredReviews[0].status).toEqual('InReview');
    expect(filteredReviews[0].ai_analysis_complete).toEqual(true);
  });
});

describe('getSecurityReviewsByContainer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no reviews exist for container', async () => {
    const reviews = await getSecurityReviewsByContainer(999);
    expect(reviews).toEqual([]);
  });

  it('should fetch all reviews for a specific container', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create reviews for the container
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: containerId,
        created_by: userId
      },
      {
        ...testReview2,
        container_id: containerId,
        created_by: userId
      }
    ]).execute();

    const reviews = await getSecurityReviewsByContainer(containerId);

    expect(reviews).toHaveLength(2);
    reviews.forEach(review => {
      expect(review.container_id).toEqual(containerId);
      expect(review.created_at).toBeInstanceOf(Date);
      expect(review.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should only return reviews for the specified container', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const container1Result = await db.insert(containersTable).values({
      ...testContainer,
      name: 'Container 1',
      created_by: userId
    }).returning().execute();
    const container1Id = container1Result[0].id;

    const container2Result = await db.insert(containersTable).values({
      ...testContainer,
      name: 'Container 2',
      created_by: userId
    }).returning().execute();
    const container2Id = container2Result[0].id;

    // Create reviews for different containers
    await db.insert(securityReviewsTable).values([
      {
        ...testReview1,
        container_id: container1Id,
        created_by: userId
      },
      {
        ...testReview2,
        container_id: container2Id,
        created_by: userId
      }
    ]).execute();

    const container1Reviews = await getSecurityReviewsByContainer(container1Id);
    const container2Reviews = await getSecurityReviewsByContainer(container2Id);

    expect(container1Reviews).toHaveLength(1);
    expect(container1Reviews[0].container_id).toEqual(container1Id);

    expect(container2Reviews).toHaveLength(1);
    expect(container2Reviews[0].container_id).toEqual(container2Id);
  });
});

describe('getSecurityReviewById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when review does not exist', async () => {
    const review = await getSecurityReviewById(999);
    expect(review).toBeNull();
  });

  it('should fetch a specific security review by ID', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create a test review
    const reviewResult = await db.insert(securityReviewsTable).values({
      ...testReview1,
      container_id: containerId,
      created_by: userId
    }).returning().execute();
    const reviewId = reviewResult[0].id;

    const review = await getSecurityReviewById(reviewId);

    expect(review).not.toBeNull();
    expect(review!.id).toEqual(reviewId);
    expect(review!.title).toEqual('Security Architecture Review');
    expect(review!.description).toEqual('Review of system architecture');
    expect(review!.container_id).toEqual(containerId);
    expect(review!.created_by).toEqual(userId);
    expect(review!.created_at).toBeInstanceOf(Date);
    expect(review!.updated_at).toBeInstanceOf(Date);
  });

  it('should return review with all fields populated', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const reviewerResult = await db.insert(usersTable).values(testReviewer).returning().execute();
    const reviewerId = reviewerResult[0].id;

    const containerResult = await db.insert(containersTable).values({
      ...testContainer,
      created_by: userId
    }).returning().execute();
    const containerId = containerResult[0].id;

    // Create a comprehensive review
    const reviewResult = await db.insert(securityReviewsTable).values({
      ...testReview1,
      container_id: containerId,
      created_by: userId,
      reviewer_id: reviewerId,
      status: 'Completed',
      ai_analysis_complete: true,
      ai_analysis_results: '{"vulnerabilities": 5, "recommendations": 3}'
    }).returning().execute();
    const reviewId = reviewResult[0].id;

    const review = await getSecurityReviewById(reviewId);

    expect(review).not.toBeNull();
    expect(review!.reviewer_id).toEqual(reviewerId);
    expect(review!.status).toEqual('Completed');
    expect(review!.ai_analysis_complete).toEqual(true);
    expect(review!.ai_analysis_results).toEqual('{"vulnerabilities": 5, "recommendations": 3}');
  });
});