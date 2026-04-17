// ============================================================
// Unit Tests for CV Auto-Tailoring
// Tests generateTailoringPackage and uploadTailoringToS3
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS clients
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

// Mock the Gemini client
const mockGenerateContent = vi.fn();
const mockGeminiClient = {
  models: {
    generateContent: mockGenerateContent,
  },
};

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => mockGeminiClient),
}));

// Mock uploadToS3
const mockUploadToS3 = vi.fn();
vi.mock('../../src/shared/s3.js', () => ({
  uploadToS3: (...args) => mockUploadToS3(...args),
}));

describe('tailoring', () => {
  let generateTailoringPackage;
  let uploadTailoringToS3;
  let setTailoringGeminiClient;
  let buildTailoringPrompt;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/evaluator/tailoring.js');
    generateTailoringPackage = mod.generateTailoringPackage;
    uploadTailoringToS3 = mod.uploadTailoringToS3;
    setTailoringGeminiClient = mod.setTailoringGeminiClient;
    buildTailoringPrompt = mod.buildTailoringPrompt;

    // Set the mock client
    setTailoringGeminiClient(mockGeminiClient);
  });

  const mockJob = {
    title: 'Full Stack Developer',
    company: 'Tech Corp',
    platform: 'LinkedIn',
    location: 'Remote',
    salary: '15-20 LPA',
    description: 'Looking for a Full Stack Developer with Node.js and React experience.',
  };

  const mockCvText = 'Experienced developer with 3+ years in Node.js, React, and AWS.';
  const mockTopSkills = ['Node.js', 'React', 'TypeScript', 'AWS', 'MongoDB'];

  describe('generateTailoringPackage', () => {
    it('should return an object with cvSnippet and coverOpening string fields', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          cvSnippet: 'A tailored CV snippet for the role.',
          coverOpening: 'Dear Tech Corp, I am excited about the Full Stack Developer role.',
        }),
      });

      const result = await generateTailoringPackage(mockJob, mockCvText, mockTopSkills);

      expect(result).toHaveProperty('cvSnippet');
      expect(result).toHaveProperty('coverOpening');
      expect(typeof result.cvSnippet).toBe('string');
      expect(typeof result.coverOpening).toBe('string');
      expect(result.cvSnippet).toBe('A tailored CV snippet for the role.');
      expect(result.coverOpening).toBe('Dear Tech Corp, I am excited about the Full Stack Developer role.');
    });

    it('should return empty strings on Gemini failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));

      const result = await generateTailoringPackage(mockJob, mockCvText, mockTopSkills);

      expect(result.cvSnippet).toBe('');
      expect(result.coverOpening).toBe('');
    });

    it('should return empty strings when Gemini returns invalid JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'not valid json at all',
      });

      const result = await generateTailoringPackage(mockJob, mockCvText, mockTopSkills);

      expect(result.cvSnippet).toBe('');
      expect(result.coverOpening).toBe('');
    });

    it('should return empty strings when client is not initialized', async () => {
      setTailoringGeminiClient(null);

      const result = await generateTailoringPackage(mockJob, mockCvText, mockTopSkills);

      expect(result.cvSnippet).toBe('');
      expect(result.coverOpening).toBe('');
    });
  });

  describe('uploadTailoringToS3', () => {
    it('should call uploadToS3 with correct key format tailoring/YYYY-MM-DD/jobId.md', async () => {
      mockUploadToS3.mockResolvedValue('https://bucket.s3.amazonaws.com/tailoring/2025-01-15/job-123.md');

      const tailoring = { cvSnippet: 'Snippet text', coverOpening: 'Opening text' };
      const result = await uploadTailoringToS3(tailoring, 'job-123');

      expect(mockUploadToS3).toHaveBeenCalledTimes(1);

      const [buffer, key, contentType] = mockUploadToS3.mock.calls[0];
      expect(key).toMatch(/^tailoring\/\d{4}-\d{2}-\d{2}\/job-123\.md$/);
      expect(contentType).toBe('text/markdown');

      const markdown = buffer.toString('utf-8');
      expect(markdown).toContain('## CV Snippet');
      expect(markdown).toContain('Snippet text');
      expect(markdown).toContain('## Cover Opening');
      expect(markdown).toContain('Opening text');

      expect(typeof result).toBe('string');
      expect(result).toContain('tailoring');
    });

    it('should return empty string on upload failure', async () => {
      mockUploadToS3.mockRejectedValue(new Error('S3 upload failed'));

      const tailoring = { cvSnippet: 'Snippet', coverOpening: 'Opening' };
      const result = await uploadTailoringToS3(tailoring, 'job-456');

      expect(result).toBe('');
    });
  });

  describe('buildTailoringPrompt', () => {
    it('should include job details and CV text in the prompt', () => {
      const prompt = buildTailoringPrompt(mockJob, mockCvText, mockTopSkills);

      expect(prompt).toContain('Tech Corp');
      expect(prompt).toContain('Full Stack Developer');
      expect(prompt).toContain(mockCvText);
      expect(prompt).toContain('Node.js, React, TypeScript, AWS, MongoDB');
    });
  });
});
