// ── Evaluation report generation & S3 upload
// Builds a full markdown report from evaluation data and uploads it to S3.

import { uploadToS3 } from '../shared/s3.js';

/**
 * Returns a human-readable recommendation string for a letter grade.
 * @param {string} grade - Letter grade (A–F).
 * @returns {string}
 */
export function getRecommendation(grade) {
  switch (grade) {
    case 'A': return 'Strong Apply - Excellent match';
    case 'B': return 'Consider - Good match';
    case 'C': return 'Consider - Moderate match';
    case 'D': return 'Skip - Weak match';
    case 'F': return 'Skip - Poor match';
    default: return 'Review manually';
  }
}

/**
 * Builds a checklist of key requirements with ✅/⚠️ indicators.
 * @param {Record<string, number>} dimensionScores
 * @returns {string} Markdown checklist.
 */
export function buildRequirementsChecklist(dimensionScores) {
  const requirements = [
    { label: 'Skills match job requirements', key: 'skillsMatch', threshold: 3.5 },
    { label: 'Experience level appropriate', key: 'experienceLevel', threshold: 3.5 },
    { label: 'Salary meets expectations', key: 'salaryRange', threshold: 3.0 },
    { label: 'Location/remote arrangement suitable', key: 'locationRemote', threshold: 3.0 },
    { label: 'Company culture aligns with preferences', key: 'cultureFit', threshold: 3.0 },
    { label: 'Growth opportunities available', key: 'growthPotential', threshold: 3.0 },
    { label: 'Tech stack matches expertise', key: 'techStackMatch', threshold: 3.5 },
    { label: 'Role responsibilities clearly defined', key: 'roleClarity', threshold: 3.0 },
  ];

  return requirements.map(req => {
    const score = dimensionScores[req.key];
    const indicator = score >= req.threshold ? '✅' : '⚠️';
    return `- ${indicator} ${req.label}`;
  }).join('\n');
}

/**
 * Builds an actionable next-steps checklist based on grade and red-flag count.
 * @param {string} grade
 * @param {number} redFlagsCount
 * @returns {string} Markdown checklist.
 */
export function buildNextStepsChecklist(grade, redFlagsCount) {
  const baseSteps = [
    '- [ ] Review full job description on platform',
    '- [ ] Research company culture and values',
    '- [ ] Customize CV to highlight relevant skills',
  ];

  if (grade === 'A' || grade === 'B') {
    baseSteps.push('- [ ] Prepare tailored cover letter');
    baseSteps.push('- [ ] Review STAR stories above and prepare examples');
    baseSteps.push('- [ ] Apply within 24-48 hours (high priority)');
  } else if (grade === 'C') {
    baseSteps.push('- [ ] Consider if this role aligns with career goals');
    baseSteps.push('- [ ] Prepare cover letter if applying');
    baseSteps.push('- [ ] Apply if no better options available');
  } else {
    baseSteps.push('- [ ] Evaluate if worth applying given low match score');
    baseSteps.push('- [ ] Consider only if desperate for opportunities');
  }

  if (redFlagsCount > 0) {
    baseSteps.push('- [ ] Address red flags mentioned above in application');
  }

  baseSteps.push('- [ ] Set reminder to follow up after application');

  return baseSteps.join('\n');
}

/**
 * Generates a full markdown evaluation report.
 * @param {object} job - The job record.
 * @param {object} evaluation - Gemini evaluation result.
 * @param {string} grade - Letter grade (A–F).
 * @param {number} totalScore - Weighted total score.
 * @returns {string} Markdown report.
 */
export function generateEvaluationReport(job, evaluation, grade, totalScore) {
  const { dimensionScores, notes, strengths, redFlags, starStories, applicationStrategy } = evaluation;

  // Build dimension scores table with notes
  const dimensionRows = [
    { name: 'Skills Match', key: 'skillsMatch', weight: 0.20 },
    { name: 'Experience Level', key: 'experienceLevel', weight: 0.15 },
    { name: 'Salary Range', key: 'salaryRange', weight: 0.15 },
    { name: 'Location/Remote', key: 'locationRemote', weight: 0.10 },
    { name: 'Company Culture Fit', key: 'cultureFit', weight: 0.10 },
    { name: 'Growth Potential', key: 'growthPotential', weight: 0.10 },
    { name: 'Tech Stack Match', key: 'techStackMatch', weight: 0.10 },
    { name: 'Role Clarity', key: 'roleClarity', weight: 0.05 },
    { name: 'Team Size', key: 'teamSize', weight: 0.03 },
    { name: 'Work-Life Balance', key: 'workLifeBalance', weight: 0.02 },
  ];

  const dimensionTable = dimensionRows.map(dim => {
    const score = dimensionScores[dim.key];
    const weighted = (score * dim.weight).toFixed(2);
    const note = notes[dim.key] || '-';
    const weightPercent = `${(dim.weight * 100).toFixed(0)}%`;
    return `| ${dim.name} | ${score.toFixed(1)} | ${weightPercent} | ${weighted} | ${note} |`;
  }).join('\n');

  // Build strengths section (3-5 bullet points)
  const strengthsList = strengths.length > 0
    ? strengths.slice(0, 5).map(s => `- ${s}`).join('\n')
    : '- No specific strengths identified';

  // Build red flags section
  const redFlagsList = redFlags.length > 0
    ? redFlags.map(r => `- ${r}`).join('\n')
    : '- None identified';

  // Build key requirements match checklist
  const requirementsChecklist = buildRequirementsChecklist(dimensionScores);

  // Build application strategy section
  const strategyHighlight = applicationStrategy.highlight.length > 0
    ? applicationStrategy.highlight.map(h => `- ${h}`).join('\n')
    : '- Review job requirements carefully';

  const strategyEmphasize = applicationStrategy.emphasize.length > 0
    ? applicationStrategy.emphasize.map(e => `- ${e}`).join('\n')
    : '- Tailor your CV to match key requirements';

  const strategyAddress = applicationStrategy.address.length > 0
    ? applicationStrategy.address.map(a => `- ${a}`).join('\n')
    : '- No significant gaps identified';

  // Build STAR stories section (3-4 suggestions)
  const starStoriesList = starStories.length > 0
    ? starStories.slice(0, 4).map((story, idx) => {
        return `### ${idx + 1}. ${story.title}\n${story.relevance}`;
      }).join('\n\n')
    : 'No specific STAR story suggestions available. Prepare general examples showcasing your key skills and achievements.';

  // Build next steps checklist
  const nextSteps = buildNextStepsChecklist(grade, redFlags.length);

  const report = `# Job Evaluation Report

## Job Details
- **Title:** ${job.title}
- **Company:** ${job.company}
- **Platform:** ${job.platform}
- **Location:** ${job.location || 'Not specified'}
- **Salary:** ${job.salary || 'Not specified'}
- **Posted:** ${job.postedDate || 'Recently'}
- **Job URL:** ${job.url}

---

## Overall Grade

**Grade:** ${grade} | **Score:** ${totalScore}/5.0

**Recommendation:** ${getRecommendation(grade)}

---

## Dimension Scores

| Dimension | Score | Weight | Weighted Value | Notes |
|-----------|-------|--------|----------------|-------|
${dimensionTable}

**Total Weighted Score:** ${totalScore}/5.0

---

## Strengths

${strengthsList}

---

## Red Flags

${redFlagsList}

---

## Key Requirements Match

${requirementsChecklist}

---

## Application Strategy

### What to Highlight
${strategyHighlight}

### What to Emphasize
${strategyEmphasize}

### What to Address
${strategyAddress}

---

## Interview Prep (STAR Stories)

${starStoriesList}

---

## Next Steps

${nextSteps}

---

*Report generated on ${new Date().toISOString().split('T')[0]}*
`;

  return report;
}

/**
 * Uploads a markdown report to S3.
 * @param {string} markdown - The report content.
 * @param {string} jobId - The job ID (used in the S3 key).
 * @returns {Promise<string>} The public S3 URL, or '' on failure.
 */
export async function uploadReportToS3(markdown, jobId) {
  const date = new Date().toISOString().split('T')[0];
  const key = `reports/${date}/${jobId}.md`;
  const buffer = Buffer.from(markdown, 'utf-8');
  return uploadToS3(buffer, key, 'text/markdown');
}
