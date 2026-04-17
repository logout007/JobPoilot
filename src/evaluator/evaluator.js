// ── Gemini AI evaluation
// Calls Google Gemini to evaluate a job against a user profile and CV,
// returning dimension scores, strengths, red flags, and application strategy.

import { GoogleGenAI } from '@google/genai';

const GEMINI_TEMPERATURE = 0.3;

/** @type {GoogleGenAI | null} */
let geminiClient = null;

/**
 * Initializes the Gemini AI client with the given API key.
 * Must be called before `evaluateJobWithGemini`.
 * @param {string} apiKey
 */
export function initGemini(apiKey) {
  geminiClient = new GoogleGenAI({ apiKey });
}

/**
 * Builds the structured evaluation prompt sent to Gemini.
 * Includes explicit scoring rubrics, few-shot examples, and strict JSON output instructions.
 * @param {object} job
 * @param {object} userProfile
 * @param {string} cvText
 * @returns {string}
 */
export function buildEvaluationPrompt(job, userProfile, cvText) {
  const jobDescription = job.description || 'No detailed description available';

  return `You are a precise job-fit evaluator. Output ONLY valid JSON. No markdown fences, no preamble, no explanation.

## Candidate Profile
${userProfile.name}, ${userProfile.role}, ${userProfile.experience} experience.
Skills: ${userProfile.skills}
Location: ${userProfile.location}. Preferred work: ${userProfile.workArrangement}.
Minimum salary: ${userProfile.minSalary} LPA. Target roles: ${userProfile.targetRoles}.

## Candidate CV
${cvText}

## Job Details
Title: ${job.title} | Company: ${job.company} | Platform: ${job.platform}
Location: ${job.location || 'Not specified'} | Salary: ${job.salary || 'Not specified'}
Posted: ${job.postedDate || 'Recently'} | URL: ${job.url}

## Full Job Description
${jobDescription}

## Scoring Rubric (0–5 scale per dimension)

1. skillsMatch (weight 20%):
   5 = All required skills present in candidate profile
   4 = 80%+ of required skills match
   3 = 60%+ of required skills match
   2 = 40%+ of required skills match
   1 = Less than 40% skills match
   0 = No skill overlap at all

2. experienceLevel (weight 15%):
   5 = Exact years match for the role
   4 = Within ±1 year of requirement
   3 = Within ±2 years of requirement
   2 = Under-qualified by 3 years
   1 = Over-qualified by 3+ years
   0 = No experience match

3. salaryRange (weight 15%):
   5 = Salary exceeds candidate minimum by 20%+
   4 = Salary exceeds candidate minimum by 10%
   3 = Salary is at candidate minimum
   2 = Salary is within 10% below minimum
   1 = Salary is 10–20% below minimum
   0 = Salary is more than 20% below minimum or not disclosed

4. locationRemote (weight 10%):
   5 = Perfect match (remote job + remote preference, or exact city match)
   4 = Hybrid option available matching preference
   3 = Same country, different city
   2 = Relocation required but within region
   1 = International relocation required
   0 = Complete location mismatch with no remote option

5. cultureFit (weight 10%):
   5 = Strong culture indicators matching candidate values
   4 = Good culture signals (modern tech company, growth mindset)
   3 = Neutral — insufficient information to assess
   2 = Some concerning signals (high turnover mentions, rigid hierarchy)
   1 = Poor culture indicators
   0 = Major red flags (toxic reviews, legal issues)

6. growthPotential (weight 10%):
   5 = Clear promotion path, mentorship, learning budget mentioned
   4 = Growth opportunities mentioned but not detailed
   3 = Standard career progression implied
   2 = Limited growth signals
   1 = Appears to be a dead-end role
   0 = No growth indicators, contract/temp role

7. techStackMatch (weight 10%):
   5 = All technologies in job match candidate's stack exactly
   4 = 80%+ tech stack overlap
   3 = 60%+ tech stack overlap
   2 = 40%+ tech stack overlap
   1 = Minimal tech overlap, significant ramp-up needed
   0 = Completely different technology stack

8. roleClarity (weight 5%):
   5 = Detailed responsibilities, clear deliverables, well-defined scope
   4 = Good role description with minor ambiguities
   3 = Average job description, some vagueness
   2 = Vague responsibilities, unclear expectations
   1 = Very poorly defined role
   0 = No meaningful role description

9. teamSize (weight 3%):
   5 = Team size explicitly mentioned and matches preference
   4 = Team context provided, reasonable size
   3 = No team size info but company size suggests reasonable team
   2 = Very large or very small team (potential concern)
   1 = Solo role or extremely large team
   0 = No information available

10. workLifeBalance (weight 2%):
    5 = Explicit WLB benefits (flexible hours, unlimited PTO, 4-day week)
    4 = Good WLB signals (standard benefits, reasonable hours)
    3 = Neutral — no specific WLB information
    2 = Some concerning signals (on-call, weekend work mentioned)
    1 = Poor WLB indicators (long hours expected, high-pressure language)
    0 = Major WLB red flags

## Few-Shot Examples

### Example 1 — High Match (Senior Full Stack Developer at a remote-first company):
{
  "dimensionScores": {
    "skillsMatch": 5,
    "experienceLevel": 4,
    "salaryRange": 5,
    "locationRemote": 5,
    "cultureFit": 4,
    "growthPotential": 4,
    "techStackMatch": 5,
    "roleClarity": 4,
    "teamSize": 3,
    "workLifeBalance": 4
  },
  "notes": {
    "skillsMatch": "All required skills (Node.js, React, TypeScript) present in candidate profile",
    "experienceLevel": "Role asks for 3-5 years, candidate has 3+ years — good fit",
    "salaryRange": "Offered 18 LPA exceeds candidate minimum of 12 LPA by 50%",
    "locationRemote": "Fully remote role matches candidate remote preference perfectly",
    "cultureFit": "Modern tech startup with flat hierarchy and innovation focus",
    "growthPotential": "Mentions tech lead track and conference budget",
    "techStackMatch": "Node.js, React, TypeScript, MongoDB, AWS — exact match",
    "roleClarity": "Clear responsibilities listed with specific deliverables",
    "teamSize": "No specific team size mentioned",
    "workLifeBalance": "Flexible hours and unlimited PTO mentioned"
  },
  "strengths": ["Perfect tech stack alignment", "Remote-first culture", "Salary 50% above minimum"],
  "redFlags": [],
  "starStories": [{"title": "Built scalable Node.js microservices", "scenario": "Designed and deployed a microservices architecture handling 10K RPM, directly relevant to the distributed systems focus of this role"}],
  "topSkills": ["Node.js", "React", "TypeScript", "MongoDB", "AWS"]
}

### Example 2 — Low Match (Java Backend Developer, on-site only):
{
  "dimensionScores": {
    "skillsMatch": 2,
    "experienceLevel": 3,
    "salaryRange": 1,
    "locationRemote": 0,
    "cultureFit": 3,
    "growthPotential": 2,
    "techStackMatch": 1,
    "roleClarity": 3,
    "teamSize": 3,
    "workLifeBalance": 2
  },
  "notes": {
    "skillsMatch": "Role requires Java and Spring Boot — candidate's stack is Node.js/React",
    "experienceLevel": "Experience level matches but in different technology",
    "salaryRange": "Offered 10 LPA is 17% below candidate minimum of 12 LPA",
    "locationRemote": "On-site only in Bangalore, candidate prefers remote",
    "cultureFit": "Traditional enterprise company, limited info on culture",
    "growthPotential": "No growth path mentioned, appears to be a maintenance role",
    "techStackMatch": "Java/Spring vs Node.js/React — minimal overlap",
    "roleClarity": "Standard job description with reasonable clarity",
    "teamSize": "No team information provided",
    "workLifeBalance": "Mentions occasional weekend deployments"
  },
  "strengths": ["Stable enterprise company"],
  "redFlags": ["Completely different tech stack", "Below minimum salary", "On-site only"],
  "starStories": [{"title": "API design experience", "scenario": "REST API design skills are transferable, though the technology stack differs significantly"}],
  "topSkills": ["REST APIs", "Backend Development"]
}

## Required JSON Output Schema
Respond with ONLY this JSON structure. Every field is required:
{
  "dimensionScores": {
    "skillsMatch": <number 0-5>,
    "experienceLevel": <number 0-5>,
    "salaryRange": <number 0-5>,
    "locationRemote": <number 0-5>,
    "cultureFit": <number 0-5>,
    "growthPotential": <number 0-5>,
    "techStackMatch": <number 0-5>,
    "roleClarity": <number 0-5>,
    "teamSize": <number 0-5>,
    "workLifeBalance": <number 0-5>
  },
  "notes": {
    "skillsMatch": "<brief explanation>",
    "experienceLevel": "<brief explanation>",
    "salaryRange": "<brief explanation>",
    "locationRemote": "<brief explanation>",
    "cultureFit": "<brief explanation>",
    "growthPotential": "<brief explanation>",
    "techStackMatch": "<brief explanation>",
    "roleClarity": "<brief explanation>",
    "teamSize": "<brief explanation>",
    "workLifeBalance": "<brief explanation>"
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "redFlags": ["<red flag 1 if any>"],
  "starStories": [{"title": "<STAR story title>", "scenario": "<situation, task, action, result>"}],
  "topSkills": ["<skill1>", "<skill2>", "<skill3>", "<skill4>", "<skill5>"]
}`;
}

/**
 * The 10 required dimension keys.
 */
export const REQUIRED_DIMENSIONS = [
  'skillsMatch',
  'experienceLevel',
  'salaryRange',
  'locationRemote',
  'cultureFit',
  'growthPotential',
  'techStackMatch',
  'roleClarity',
  'teamSize',
  'workLifeBalance',
];

/**
 * Validates that a Gemini evaluation response contains all required fields
 * and that values are within expected ranges.
 * Returns an array of error messages (empty if valid).
 * @param {object} evaluation
 * @returns {string[]} Array of validation error messages.
 */
export function validateEvaluationSchema(evaluation) {
  const errors = [];

  // Validate dimensionScores object exists
  if (!evaluation.dimensionScores || typeof evaluation.dimensionScores !== 'object') {
    errors.push('Missing or invalid "dimensionScores" object');
  } else {
    // Validate all 10 dimension keys present and values in [0, 5]
    for (const dim of REQUIRED_DIMENSIONS) {
      const val = evaluation.dimensionScores[dim];
      if (typeof val !== 'number') {
        errors.push(`Missing or non-numeric dimension score: ${dim}`);
      } else if (val < 0 || val > 5) {
        errors.push(`Dimension score out of range [0,5]: ${dim} = ${val}`);
      }
    }
  }

  // Validate notes object
  if (!evaluation.notes || typeof evaluation.notes !== 'object') {
    errors.push('Missing or invalid "notes" object');
  } else {
    for (const dim of REQUIRED_DIMENSIONS) {
      if (typeof evaluation.notes[dim] !== 'string') {
        errors.push(`Missing or invalid dimension note: ${dim}`);
      }
    }
  }

  // Validate required arrays
  if (!Array.isArray(evaluation.strengths)) {
    errors.push('"strengths" must be an array');
  }
  if (!Array.isArray(evaluation.redFlags)) {
    errors.push('"redFlags" must be an array');
  }
  if (!Array.isArray(evaluation.starStories)) {
    errors.push('"starStories" must be an array');
  }
  if (!Array.isArray(evaluation.topSkills)) {
    errors.push('"topSkills" must be an array');
  }

  return errors;
}

/**
 * Validates that a Gemini evaluation response contains all required fields.
 * Throws if any field is missing or invalid.
 * @param {object} evaluation
 */
export function validateEvaluationResponse(evaluation) {
  const errors = validateEvaluationSchema(evaluation);
  if (errors.length > 0) {
    throw new Error(`Schema validation failed: ${errors.join('; ')}`);
  }
}

/**
 * Builds a correction prompt to send back to Gemini when the initial response
 * fails schema validation.
 * @param {string} invalidResponse - The raw invalid JSON response.
 * @param {string[]} errors - Validation error messages.
 * @returns {string}
 */
function buildCorrectionPrompt(invalidResponse, errors) {
  return `Your previous response failed JSON schema validation. Here are the errors:
${errors.map(e => `- ${e}`).join('\n')}

Your previous response was:
${invalidResponse}

Please fix the response and output ONLY valid JSON matching this exact schema. All dimension scores must be numbers between 0 and 5. All required arrays (strengths, redFlags, starStories, topSkills) must be present.

Required JSON structure:
{
  "dimensionScores": { "skillsMatch": N, "experienceLevel": N, "salaryRange": N, "locationRemote": N, "cultureFit": N, "growthPotential": N, "techStackMatch": N, "roleClarity": N, "teamSize": N, "workLifeBalance": N },
  "notes": { "skillsMatch": "...", "experienceLevel": "...", "salaryRange": "...", "locationRemote": "...", "cultureFit": "...", "growthPotential": "...", "techStackMatch": "...", "roleClarity": "...", "teamSize": "...", "workLifeBalance": "..." },
  "strengths": ["..."],
  "redFlags": ["..."],
  "starStories": [{"title": "...", "scenario": "..."}],
  "topSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"]
}`;
}

/**
 * Returns the default evaluation object used when Gemini fails.
 * @returns {object}
 */
function getDefaultEvaluation() {
  return {
    dimensionScores: {
      skillsMatch: 3.0,
      experienceLevel: 3.0,
      salaryRange: 3.0,
      locationRemote: 3.0,
      cultureFit: 3.0,
      growthPotential: 3.0,
      techStackMatch: 3.0,
      roleClarity: 3.0,
      teamSize: 3.0,
      workLifeBalance: 3.0,
    },
    notes: {
      skillsMatch: 'Evaluation failed - default grade assigned',
      experienceLevel: 'Evaluation failed - default grade assigned',
      salaryRange: 'Evaluation failed - default grade assigned',
      locationRemote: 'Evaluation failed - default grade assigned',
      cultureFit: 'Evaluation failed - default grade assigned',
      growthPotential: 'Evaluation failed - default grade assigned',
      techStackMatch: 'Evaluation failed - default grade assigned',
      roleClarity: 'Evaluation failed - default grade assigned',
      teamSize: 'Evaluation failed - default grade assigned',
      workLifeBalance: 'Evaluation failed - default grade assigned',
    },
    strengths: ['Unable to evaluate - API error or unparseable response'],
    redFlags: ['Evaluation failed - manual review recommended'],
    starStories: [],
    topSkills: [],
    applicationStrategy: {
      highlight: ['Review job manually'],
      emphasize: ['Check requirements carefully'],
      address: ['Evaluation system encountered an error'],
    },
  };
}

/**
 * Evaluates a job using Gemini AI.
 * On schema validation failure, retries once with a correction prompt.
 * On final failure returns default scores (all dimensions = 3.0).
 * @param {object} job
 * @param {object} userProfile
 * @param {string} cvText
 * @returns {Promise<object>} Evaluation result with dimensionScores, notes, strengths, etc.
 */
export async function evaluateJobWithGemini(job, userProfile, cvText) {
  const prompt = buildEvaluationPrompt(job, userProfile, cvText);

  let rawResponse = null;

  try {
    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    rawResponse = text;
    console.log(`[Gemini Evaluation] Response preview: ${text.slice(0, 200)}`);

    const evaluation = JSON.parse(text);

    // Schema validation (Req 11.4)
    const errors = validateEvaluationSchema(evaluation);
    if (errors.length > 0) {
      console.warn(`[Gemini Evaluation] Schema validation failed: ${errors.join('; ')}`);

      // Correction retry (Req 11.5)
      console.log('[Gemini Evaluation] Attempting correction retry...');
      const correctionPrompt = buildCorrectionPrompt(text, errors);

      const retryResponse = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: correctionPrompt,
        config: {
          temperature: GEMINI_TEMPERATURE,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      const retryText = retryResponse.text?.trim() || '{}';
      console.log(`[Gemini Evaluation] Correction response preview: ${retryText.slice(0, 200)}`);

      const retryEvaluation = JSON.parse(retryText);
      const retryErrors = validateEvaluationSchema(retryEvaluation);

      if (retryErrors.length > 0) {
        console.error(`[Gemini Evaluation] Correction retry also failed: ${retryErrors.join('; ')}`);
        return getDefaultEvaluation();
      }

      return retryEvaluation;
    }

    return evaluation;
  } catch (error) {
    console.error('[Gemini Evaluation] Error:', error.message);
    console.error('[Gemini Evaluation] Error type:', error.name);

    if (rawResponse) {
      console.error('[Gemini Evaluation] Raw response for debugging:', rawResponse);
    }

    return getDefaultEvaluation();
  }
}
