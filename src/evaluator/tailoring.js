// ── CV Auto-Tailoring
// Generates a tailored CV snippet and cover letter opening using Gemini AI,
// then uploads the combined package to S3 as markdown.

import { GoogleGenAI } from '@google/genai';
import { uploadToS3 } from '../shared/s3.js';

const GEMINI_TEMPERATURE = 0.3;

/** @type {GoogleGenAI | null} */
let geminiClient = null;

/**
 * Initializes the Gemini AI client for tailoring.
 * @param {string} apiKey
 */
export function initTailoringGemini(apiKey) {
  geminiClient = new GoogleGenAI({ apiKey });
}

/**
 * Allows setting the gemini client directly (useful for testing or sharing).
 * @param {GoogleGenAI} client
 */
export function setTailoringGeminiClient(client) {
  geminiClient = client;
}

/**
 * Builds the tailoring prompt for Gemini.
 * @param {object} job - The job record.
 * @param {string} cvText - Full candidate CV text.
 * @param {string[]} topSkills - Top 5 relevant skills from evaluation.
 * @returns {string}
 */
export function buildTailoringPrompt(job, cvText, topSkills) {
  const skillsList = (topSkills || []).slice(0, 5).join(', ');

  return `You are an expert CV writer and career coach. Output ONLY valid JSON. No markdown fences, no preamble, no explanation.

## Task
Generate a tailored CV snippet and cover letter opening for the following job application.

## Candidate CV
${cvText}

## Job Details
Title: ${job.title}
Company: ${job.company}
Platform: ${job.platform || 'Unknown'}
Location: ${job.location || 'Not specified'}
Salary: ${job.salary || 'Not specified'}

## Full Job Description
${job.description || 'No description available'}

## Top Relevant Skills
${skillsList}

## Instructions

1. **CV_Snippet** (150–200 words):
   - Write a professional summary paragraph in first person
   - Reposition the candidate's experience to match this specific job's key requirements
   - Reference at least 2 specific skills or projects from the candidate's CV that are directly relevant
   - Make it ready to paste directly into a CV summary section

2. **Cover_Opening** (2–3 sentences):
   - Address the company by name ("${job.company}")
   - Reference the specific role title ("${job.title}")
   - Express genuine interest and briefly highlight why the candidate is a strong fit

## Required JSON Output
{
  "cvSnippet": "<150-200 word CV summary paragraph>",
  "coverOpening": "<2-3 sentence cover letter opening>"
}`;
}

/**
 * Generates a CV snippet and cover letter opening tailored to the job.
 * @param {object} job - The job record.
 * @param {string} cvText - Full candidate CV text.
 * @param {string[]} topSkills - Top 5 relevant skills from evaluation.
 * @returns {Promise<{ cvSnippet: string, coverOpening: string }>}
 */
export async function generateTailoringPackage(job, cvText, topSkills) {
  try {
    if (!geminiClient) {
      console.error('[Tailoring] Gemini client not initialized');
      return { cvSnippet: '', coverOpening: '' };
    }

    const prompt = buildTailoringPrompt(job, cvText, topSkills);

    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    console.log(`[Tailoring] Response preview: ${text.slice(0, 200)}`);

    const parsed = JSON.parse(text);

    return {
      cvSnippet: typeof parsed.cvSnippet === 'string' ? parsed.cvSnippet : '',
      coverOpening: typeof parsed.coverOpening === 'string' ? parsed.coverOpening : '',
    };
  } catch (error) {
    console.error('[Tailoring] Failed to generate tailoring package:', error.message);
    return { cvSnippet: '', coverOpening: '' };
  }
}

/**
 * Uploads the tailoring package as markdown to S3.
 * @param {{ cvSnippet: string, coverOpening: string }} tailoring
 * @param {string} jobId
 * @returns {Promise<string>} S3 URL, or '' on failure.
 */
export async function uploadTailoringToS3(tailoring, jobId) {
  try {
    const markdown = `## CV Snippet\n${tailoring.cvSnippet}\n\n## Cover Opening\n${tailoring.coverOpening}`;
    const date = new Date().toISOString().split('T')[0];
    const key = `tailoring/${date}/${jobId}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');
    return await uploadToS3(buffer, key, 'text/markdown');
  } catch (error) {
    console.error(`[Tailoring] Failed to upload tailoring for ${jobId}:`, error.message);
    return '';
  }
}
