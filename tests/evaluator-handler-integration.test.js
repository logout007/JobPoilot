// ============================================================
// Integration Tests for Job_Evaluator Handler
// Task 10.2: Test Job_Evaluator locally
// Purpose: Comprehensive testing of src/evaluator/index.js
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Create AWS SDK mocks
const dynamoMock = mockClient(DynamoDBClient);
const ssmMock = mockClient(SSMClient);
const s3Mock = mockClient(S3Client);
const sesMock = mockClient(SESClient);

// Mock Gemini AI
const mockGeminiClient = {
  models: {
    generateContent: vi.fn(),
  },
};

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => mockGeminiClient),
}));

describe('Job_Evaluator Handler - Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoMock.reset();
    ssmMock.reset();
    s3Mock.reset();
    sesMock.reset();
    vi.clearAllMocks();
    
    // Setup default SSM parameter responses
    ssmMock.on(GetParameterCommand, { Name: '/jobpilot/gemini/apikey' })
      .resolves({ Parameter: { Value: 'test-gemini-key' } });
    
    ssmMock.on(GetParameterCommand, { Name: '/jobpilot/cv/text' })
      .resolves({ Parameter: { Value: 'Test CV content with Node.js and React experience' } });
    
    ssmMock.on(GetParameterCommand, { Name: '/jobpilot/notify/email' })
      .resolves({ Parameter: { Value: 'test@example.com' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('10-Dimension Scoring', () => {
    it('should evaluate job with all 10 dimensions using Gemini AI', async () => {
      // Mock DynamoDB to return a job with status "New"
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'linkedin-123' },
          title: { S: 'Full Stack Developer' },
          company: { S: 'Tech Corp' },
          platform: { S: 'LinkedIn' },
          location: { S: 'Remote' },
          salary: { S: '15-20 LPA' },
          url: { S: 'https://linkedin.com/jobs/123' },
          postedDate: { S: '2 days ago' },
          description: { S: 'Looking for Full Stack Developer with Node.js and React' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      // Mock Gemini AI response with all 10 dimensions
      const mockEvaluation = {
        dimensionScores: {
          skillsMatch: 4.5,
          experienceLevel: 4.0,
          salaryRange: 4.5,
          locationRemote: 5.0,
          cultureFit: 4.0,
          growthPotential: 4.0,
          techStackMatch: 4.5,
          roleClarity: 4.0,
          teamSize: 3.5,
          workLifeBalance: 4.0,
        },
        notes: {
          skillsMatch: 'Strong Node.js and React match',
          experienceLevel: 'Good fit for experience level',
          salaryRange: 'Meets salary expectations',
          locationRemote: 'Perfect remote match',
          cultureFit: 'Tech-focused culture',
          growthPotential: 'Good growth opportunities',
          techStackMatch: 'Excellent tech stack alignment',
          roleClarity: 'Well-defined role',
          teamSize: 'Moderate team size',
          workLifeBalance: 'Good work-life balance indicators',
        },
        strengths: ['Strong tech stack match', 'Remote work', 'Good salary'],
        redFlags: [],
        starStories: [
          { title: 'Built scalable API', relevance: 'Demonstrates backend skills' },
        ],
        topSkills: ['Node.js', 'React', 'TypeScript', 'MongoDB', 'AWS'],
        applicationStrategy: {
          highlight: ['Node.js experience'],
          emphasize: ['Full stack capabilities'],
          address: [],
        },
      };

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify(mockEvaluation),
      });

      // Mock S3 upload success
      s3Mock.on(PutObjectCommand).resolves({});

      // Mock DynamoDB update success
      dynamoMock.on(UpdateItemCommand).resolves({});

      // Mock SES send success
      sesMock.on(SendEmailCommand).resolves({});

      // Import and execute handler
      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      // Verify Gemini was called
      expect(mockGeminiClient.models.generateContent).toHaveBeenCalled();

      // Verify all 10 dimensions were included in the evaluation
      const geminiCall = mockGeminiClient.models.generateContent.mock.calls[0][0];
      expect(geminiCall.contents).toContain('skillsMatch');
      expect(geminiCall.contents).toContain('experienceLevel');
      expect(geminiCall.contents).toContain('salaryRange');
      expect(geminiCall.contents).toContain('locationRemote');
      expect(geminiCall.contents).toContain('cultureFit');
      expect(geminiCall.contents).toContain('growthPotential');
      expect(geminiCall.contents).toContain('techStackMatch');
      expect(geminiCall.contents).toContain('roleClarity');
      expect(geminiCall.contents).toContain('teamSize');
      expect(geminiCall.contents).toContain('workLifeBalance');

      // Verify result
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.evaluated).toBe(1);
    });

    it('should use correct dimension weights in evaluation', async () => {
      // The weights should be:
      // skillsMatch: 20%, experienceLevel: 15%, salaryRange: 15%
      // locationRemote: 10%, cultureFit: 10%, growthPotential: 10%
      // techStackMatch: 10%, roleClarity: 5%, teamSize: 3%, workLifeBalance: 2%
      
      const dimensionScores = {
        skillsMatch: 5.0,      // 5.0 * 0.20 = 1.00
        experienceLevel: 5.0,  // 5.0 * 0.15 = 0.75
        salaryRange: 5.0,      // 5.0 * 0.15 = 0.75
        locationRemote: 5.0,   // 5.0 * 0.10 = 0.50
        cultureFit: 5.0,       // 5.0 * 0.10 = 0.50
        growthPotential: 5.0,  // 5.0 * 0.10 = 0.50
        techStackMatch: 5.0,   // 5.0 * 0.10 = 0.50
        roleClarity: 5.0,      // 5.0 * 0.05 = 0.25
        teamSize: 5.0,         // 5.0 * 0.03 = 0.15
        workLifeBalance: 5.0,  // 5.0 * 0.02 = 0.10
      };
      // Total: 5.00

      const DIMENSION_WEIGHTS = {
        skillsMatch: 0.20,
        experienceLevel: 0.15,
        salaryRange: 0.15,
        locationRemote: 0.10,
        cultureFit: 0.10,
        growthPotential: 0.10,
        techStackMatch: 0.10,
        roleClarity: 0.05,
        teamSize: 0.03,
        workLifeBalance: 0.02,
      };

      let totalScore = 0;
      for (const [dimension, score] of Object.entries(dimensionScores)) {
        const weight = DIMENSION_WEIGHTS[dimension];
        totalScore += score * weight;
      }

      expect(totalScore).toBe(5.0);
      expect(Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(1.0);
    });
  });

  describe('Grade Calculation', () => {
    it('should calculate grade A for score >= 4.5', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'test-1' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test description' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 4.5, experienceLevel: 4.5, salaryRange: 4.5,
            locationRemote: 4.5, cultureFit: 4.5, growthPotential: 4.5,
            techStackMatch: 4.5, roleClarity: 4.5, teamSize: 4.5, workLifeBalance: 4.5,
          },
          notes: { skillsMatch: 'Test', experienceLevel: 'Test', salaryRange: 'Test',
            locationRemote: 'Test', cultureFit: 'Test', growthPotential: 'Test',
            techStackMatch: 'Test', roleClarity: 'Test', teamSize: 'Test', workLifeBalance: 'Test' },
          strengths: ['Test'], redFlags: [], starStories: [],
          topSkills: ['Node.js', 'React', 'TypeScript'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});
      sesMock.on(SendEmailCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gradesDistribution.A).toBe(1);
    });

    it('should calculate grade B for score 4.0-4.49', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'test-2' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test description' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 4.0, experienceLevel: 4.0, salaryRange: 4.0,
            locationRemote: 4.0, cultureFit: 4.0, growthPotential: 4.0,
            techStackMatch: 4.0, roleClarity: 4.0, teamSize: 4.0, workLifeBalance: 4.0,
          },
          notes: { skillsMatch: 'Test', experienceLevel: 'Test', salaryRange: 'Test',
            locationRemote: 'Test', cultureFit: 'Test', growthPotential: 'Test',
            techStackMatch: 'Test', roleClarity: 'Test', teamSize: 'Test', workLifeBalance: 'Test' },
          strengths: ['Test'], redFlags: [], starStories: [],
          topSkills: ['Node.js', 'React', 'TypeScript'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gradesDistribution.B).toBe(1);
    });

    it('should calculate grade D for fallback scores (all 3.0)', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'test-3' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test description' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      // Mock Gemini API failure to trigger fallback
      mockGeminiClient.models.generateContent.mockRejectedValue(new Error('API Error'));

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Fallback scores are all 3.0, which should result in grade D
      expect(body.gradesDistribution.D).toBe(1);
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report with all required sections', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'report-test-1' },
          title: { S: 'Senior Developer' },
          company: { S: 'Tech Inc' },
          platform: { S: 'LinkedIn' },
          location: { S: 'Remote' },
          salary: { S: '₹20 LPA' },
          url: { S: 'https://test.com/job' },
          postedDate: { S: '1 day ago' },
          description: { S: 'Great opportunity' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 4.5, experienceLevel: 4.0, salaryRange: 4.5,
            locationRemote: 5.0, cultureFit: 4.0, growthPotential: 4.0,
            techStackMatch: 4.5, roleClarity: 4.0, teamSize: 3.5, workLifeBalance: 4.0,
          },
          notes: {
            skillsMatch: 'Excellent match', experienceLevel: 'Good fit',
            salaryRange: 'Meets expectations', locationRemote: 'Perfect',
            cultureFit: 'Good culture', growthPotential: 'Great growth',
            techStackMatch: 'Perfect stack', roleClarity: 'Clear role',
            teamSize: 'Good size', workLifeBalance: 'Balanced',
          },
          strengths: ['Great tech stack', 'Remote work', 'Good salary'],
          redFlags: ['Fast-paced environment'],
          starStories: [
            { title: 'API Development', relevance: 'Shows backend skills' },
          ],
          topSkills: ['Node.js', 'React', 'TypeScript', 'AWS', 'MongoDB'],
          applicationStrategy: {
            highlight: ['Node.js expertise'],
            emphasize: ['Leadership skills'],
            address: ['Startup experience'],
          },
        }),
      });

      let capturedReport = '';
      s3Mock.on(PutObjectCommand).callsFake((params) => {
        capturedReport = params.Body instanceof Buffer ? params.Body.toString('utf-8') : params.Body;
        return Promise.resolve({});
      });

      dynamoMock.on(UpdateItemCommand).resolves({});
      sesMock.on(SendEmailCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      await handler({});

      // Verify report structure
      expect(capturedReport).toContain('# Job Evaluation Report');
      expect(capturedReport).toContain('## Job Details');
      expect(capturedReport).toContain('## Overall Grade');
      expect(capturedReport).toContain('## Dimension Scores');
      expect(capturedReport).toContain('## Strengths');
      expect(capturedReport).toContain('## Red Flags');
      expect(capturedReport).toContain('## Key Requirements Match');
      expect(capturedReport).toContain('## Application Strategy');
      expect(capturedReport).toContain('## Interview Prep (STAR Stories)');
      expect(capturedReport).toContain('## Next Steps');

      // Verify content
      expect(capturedReport).toContain('Senior Developer');
      expect(capturedReport).toContain('Tech Inc');
      expect(capturedReport).toContain('Great tech stack');
      expect(capturedReport).toContain('Fast-paced environment');
      expect(capturedReport).toContain('API Development');
    });
  });

  describe('A-Grade Notifications', () => {
    it('should send email notification for A-grade jobs', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'a-grade-1' },
          title: { S: 'Excellent Job' },
          company: { S: 'Top Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com/job' },
          description: { S: 'Perfect match' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 5.0, experienceLevel: 5.0, salaryRange: 5.0,
            locationRemote: 5.0, cultureFit: 5.0, growthPotential: 5.0,
            techStackMatch: 5.0, roleClarity: 5.0, teamSize: 5.0, workLifeBalance: 5.0,
          },
          notes: {
            skillsMatch: 'Perfect', experienceLevel: 'Perfect', salaryRange: 'Perfect',
            locationRemote: 'Perfect', cultureFit: 'Perfect', growthPotential: 'Perfect',
            techStackMatch: 'Perfect', roleClarity: 'Perfect', teamSize: 'Perfect',
            workLifeBalance: 'Perfect',
          },
          strengths: ['Perfect match', 'Great company', 'Excellent salary'],
          redFlags: [],
          starStories: [],
          topSkills: ['Node.js', 'React', 'TypeScript', 'AWS', 'MongoDB'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});
      
      let emailsSent = [];
      sesMock.on(SendEmailCommand).callsFake((params) => {
        emailsSent.push(params.Message?.Body?.Html?.Data || '');
        return Promise.resolve({});
      });

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.aGradeJobs).toBe(1);
      expect(emailsSent.length).toBeGreaterThanOrEqual(1);
      // The first email is the A-grade notification
      const aGradeEmail = emailsSent[0];
      expect(aGradeEmail).toContain('Excellent Job');
      expect(aGradeEmail).toContain('Top Company');
      expect(aGradeEmail).toContain('Perfect match');
    });

    it('should not send email when no A-grade jobs found', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'b-grade-1' },
          title: { S: 'Good Job' },
          company: { S: 'Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com/job' },
          description: { S: 'Good match' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 4.0, experienceLevel: 4.0, salaryRange: 4.0,
            locationRemote: 4.0, cultureFit: 4.0, growthPotential: 4.0,
            techStackMatch: 4.0, roleClarity: 4.0, teamSize: 4.0, workLifeBalance: 4.0,
          },
          notes: {
            skillsMatch: 'Good', experienceLevel: 'Good', salaryRange: 'Good',
            locationRemote: 'Good', cultureFit: 'Good', growthPotential: 'Good',
            techStackMatch: 'Good', roleClarity: 'Good', teamSize: 'Good', workLifeBalance: 'Good',
          },
          strengths: ['Good match'],
          redFlags: [],
          starStories: [],
          topSkills: ['Node.js', 'React'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});

      let aGradeEmailSent = false;
      sesMock.on(SendEmailCommand).callsFake((params) => {
        const subject = params.Message?.Subject?.Data || '';
        if (subject.includes('A-Grade')) {
          aGradeEmailSent = true;
        }
        return Promise.resolve({});
      });

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.aGradeJobs).toBe(0);
      expect(aGradeEmailSent).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Gemini API errors with fallback scores', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'error-test-1' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      // Mock Gemini API failure
      mockGeminiClient.models.generateContent.mockRejectedValue(
        new Error('Gemini API unavailable')
      );

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      // Should still complete successfully with fallback scores
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.evaluated).toBe(1);
      expect(body.errors).toBe(0);
    });

    it('should handle unparseable JSON from Gemini with fallback', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'json-error-1' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      // Mock Gemini returning invalid JSON
      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: 'This is not valid JSON {broken',
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      // Should handle gracefully with fallback
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.evaluated).toBe(1);
    });

    it('should continue processing when S3 upload fails', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 's3-error-1' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 4.0, experienceLevel: 4.0, salaryRange: 4.0,
            locationRemote: 4.0, cultureFit: 4.0, growthPotential: 4.0,
            techStackMatch: 4.0, roleClarity: 4.0, teamSize: 4.0, workLifeBalance: 4.0,
          },
          notes: {
            skillsMatch: 'Test', experienceLevel: 'Test', salaryRange: 'Test',
            locationRemote: 'Test', cultureFit: 'Test', growthPotential: 'Test',
            techStackMatch: 'Test', roleClarity: 'Test', teamSize: 'Test', workLifeBalance: 'Test',
          },
          strengths: ['Test'],
          redFlags: [],
          starStories: [],
          topSkills: ['Node.js', 'React'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      // Mock S3 failure
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 unavailable'));
      dynamoMock.on(UpdateItemCommand).resolves({});

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      // Should still complete successfully
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.evaluated).toBe(1);
    });

    it('should handle SES failures gracefully', async () => {
      dynamoMock.on(ScanCommand).resolves({
        Items: [{
          jobId: { S: 'ses-error-1' },
          title: { S: 'Test Job' },
          company: { S: 'Test Company' },
          platform: { S: 'LinkedIn' },
          url: { S: 'https://test.com' },
          description: { S: 'Test' },
          status: { S: 'New' },
          foundAt: { N: '1234567890' },
        }],
      });

      mockGeminiClient.models.generateContent.mockResolvedValue({
        text: JSON.stringify({
          dimensionScores: {
            skillsMatch: 5.0, experienceLevel: 5.0, salaryRange: 5.0,
            locationRemote: 5.0, cultureFit: 5.0, growthPotential: 5.0,
            techStackMatch: 5.0, roleClarity: 5.0, teamSize: 5.0, workLifeBalance: 5.0,
          },
          notes: {
            skillsMatch: 'Perfect', experienceLevel: 'Perfect', salaryRange: 'Perfect',
            locationRemote: 'Perfect', cultureFit: 'Perfect', growthPotential: 'Perfect',
            techStackMatch: 'Perfect', roleClarity: 'Perfect', teamSize: 'Perfect',
            workLifeBalance: 'Perfect',
          },
          strengths: ['Perfect'],
          redFlags: [],
          starStories: [],
          topSkills: ['Node.js', 'React', 'TypeScript'],
          applicationStrategy: { highlight: [], emphasize: [], address: [] },
        }),
      });

      s3Mock.on(PutObjectCommand).resolves({});
      dynamoMock.on(UpdateItemCommand).resolves({});
      
      // Mock SES failure
      sesMock.on(SendEmailCommand).rejects(new Error('SES unavailable'));

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      // Should still complete successfully even if email fails
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.evaluated).toBe(1);
      expect(body.aGradeJobs).toBe(1);
    });
  });

  describe('No Jobs Scenario', () => {
    it('should handle case when no new jobs are found', async () => {
      // Mock DynamoDB returning no jobs
      dynamoMock.on(ScanCommand).resolves({ Items: [] });

      const { handler } = await import('../src/evaluator/index.js');
      const result = await handler({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('No new jobs to evaluate');
    });
  });
});
