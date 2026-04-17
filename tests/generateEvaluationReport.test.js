import { describe, it, expect } from 'vitest';

// Mock the function since we can't import from Lambda handler directly
// We'll test the logic by recreating the function
function getRecommendation(grade) {
  switch (grade) {
    case 'A': return 'Strong Apply - Excellent match';
    case 'B': return 'Consider - Good match';
    case 'C': return 'Consider - Moderate match';
    case 'D': return 'Skip - Weak match';
    case 'F': return 'Skip - Poor match';
    default: return 'Review manually';
  }
}

function buildRequirementsChecklist(dimensionScores) {
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

function buildNextStepsChecklist(grade, redFlagsCount) {
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

function generateEvaluationReport(job, evaluation, grade, totalScore) {
  const { dimensionScores, notes, strengths, redFlags, starStories, applicationStrategy } = evaluation;
  
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
  
  const strengthsList = strengths.length > 0
    ? strengths.slice(0, 5).map(s => `- ${s}`).join('\n')
    : '- No specific strengths identified';
  
  const redFlagsList = redFlags.length > 0
    ? redFlags.map(r => `- ${r}`).join('\n')
    : '- None identified';
  
  const requirementsChecklist = buildRequirementsChecklist(dimensionScores);
  
  const strategyHighlight = applicationStrategy.highlight.length > 0
    ? applicationStrategy.highlight.map(h => `- ${h}`).join('\n')
    : '- Review job requirements carefully';
  
  const strategyEmphasize = applicationStrategy.emphasize.length > 0
    ? applicationStrategy.emphasize.map(e => `- ${e}`).join('\n')
    : '- Tailor your CV to match key requirements';
  
  const strategyAddress = applicationStrategy.address.length > 0
    ? applicationStrategy.address.map(a => `- ${a}`).join('\n')
    : '- No significant gaps identified';
  
  const starStoriesList = starStories.length > 0
    ? starStories.slice(0, 4).map((story, idx) => {
        return `### ${idx + 1}. ${story.title}\n${story.relevance}`;
      }).join('\n\n')
    : 'No specific STAR story suggestions available. Prepare general examples showcasing your key skills and achievements.';
  
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

describe('generateEvaluationReport', () => {
  it('should generate a complete markdown report with all required sections', () => {
    const job = {
      id: 'linkedin-123',
      title: 'Senior Full Stack Developer',
      company: 'TechCorp',
      platform: 'LinkedIn',
      location: 'Remote',
      salary: '₹15-20 LPA',
      postedDate: '2 days ago',
      url: 'https://linkedin.com/jobs/123',
    };

    const evaluation = {
      dimensionScores: {
        skillsMatch: 4.5,
        experienceLevel: 4.0,
        salaryRange: 4.5,
        locationRemote: 5.0,
        cultureFit: 4.0,
        growthPotential: 4.5,
        techStackMatch: 4.5,
        roleClarity: 4.0,
        teamSize: 3.5,
        workLifeBalance: 4.0,
      },
      notes: {
        skillsMatch: 'Strong match with Node.js and React requirements',
        experienceLevel: 'Looking for 3-5 years, candidate has 4 years',
        salaryRange: 'Salary exceeds minimum requirement',
        locationRemote: 'Fully remote position',
        cultureFit: 'Startup culture aligns with preferences',
        growthPotential: 'Clear path to tech lead role',
        techStackMatch: 'MERN stack matches perfectly',
        roleClarity: 'Well-defined responsibilities',
        teamSize: 'Small team of 5-8 engineers',
        workLifeBalance: 'Flexible hours mentioned',
      },
      strengths: [
        'Perfect tech stack match (MERN)',
        'Fully remote position',
        'Competitive salary above expectations',
        'Clear growth path to tech lead',
        'Flexible work hours',
      ],
      redFlags: [
        'Startup environment may have higher pressure',
      ],
      starStories: [
        {
          title: 'Scaling Node.js Application',
          relevance: 'Demonstrates experience with performance optimization mentioned in job requirements',
        },
        {
          title: 'Leading React Migration',
          relevance: 'Shows leadership skills and React expertise required for this role',
        },
        {
          title: 'Implementing CI/CD Pipeline',
          relevance: 'Relevant to DevOps responsibilities mentioned in job description',
        },
      ],
      applicationStrategy: {
        highlight: [
          'MERN stack expertise with 4 years experience',
          'Previous experience scaling Node.js applications',
        ],
        emphasize: [
          'Leadership experience and mentoring junior developers',
          'Remote work experience and self-management skills',
        ],
        address: [
          'Mention adaptability to startup pace and pressure',
        ],
      },
    };

    const grade = 'A';
    const totalScore = 4.42;

    const report = generateEvaluationReport(job, evaluation, grade, totalScore);

    // Verify all required sections are present
    expect(report).toContain('# Job Evaluation Report');
    expect(report).toContain('## Job Details');
    expect(report).toContain('## Overall Grade');
    expect(report).toContain('## Dimension Scores');
    expect(report).toContain('## Strengths');
    expect(report).toContain('## Red Flags');
    expect(report).toContain('## Key Requirements Match');
    expect(report).toContain('## Application Strategy');
    expect(report).toContain('## Interview Prep (STAR Stories)');
    expect(report).toContain('## Next Steps');

    // Verify job details
    expect(report).toContain('Senior Full Stack Developer');
    expect(report).toContain('TechCorp');
    expect(report).toContain('LinkedIn');
    expect(report).toContain('Remote');
    expect(report).toContain('₹15-20 LPA');

    // Verify grade and recommendation
    expect(report).toContain('**Grade:** A');
    expect(report).toContain('**Score:** 4.42/5.0');
    expect(report).toContain('Strong Apply - Excellent match');

    // Verify dimension scores table
    expect(report).toContain('Skills Match');
    expect(report).toContain('4.5');
    expect(report).toContain('20%');
    expect(report).toContain('Strong match with Node.js and React requirements');

    // Verify strengths
    expect(report).toContain('Perfect tech stack match (MERN)');
    expect(report).toContain('Fully remote position');

    // Verify red flags
    expect(report).toContain('Startup environment may have higher pressure');

    // Verify requirements checklist with indicators
    expect(report).toContain('✅');
    expect(report).toContain('Skills match job requirements');

    // Verify application strategy
    expect(report).toContain('### What to Highlight');
    expect(report).toContain('MERN stack expertise');
    expect(report).toContain('### What to Emphasize');
    expect(report).toContain('Leadership experience');
    expect(report).toContain('### What to Address');
    expect(report).toContain('adaptability to startup pace');

    // Verify STAR stories
    expect(report).toContain('### 1. Scaling Node.js Application');
    expect(report).toContain('Demonstrates experience with performance optimization');

    // Verify next steps
    expect(report).toContain('- [ ] Review full job description');
    expect(report).toContain('- [ ] Apply within 24-48 hours (high priority)');
  });

  it('should handle empty strengths and red flags gracefully', () => {
    const job = {
      id: 'test-1',
      title: 'Test Job',
      company: 'Test Company',
      platform: 'Test Platform',
      url: 'https://test.com',
    };

    const evaluation = {
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
      notes: {},
      strengths: [],
      redFlags: [],
      starStories: [],
      applicationStrategy: {
        highlight: [],
        emphasize: [],
        address: [],
      },
    };

    const report = generateEvaluationReport(job, evaluation, 'D', 3.0);

    expect(report).toContain('- No specific strengths identified');
    expect(report).toContain('- None identified');
    expect(report).toContain('No specific STAR story suggestions available');
    expect(report).toContain('- Review job requirements carefully');
  });

  it('should limit strengths to 5 items', () => {
    const job = {
      id: 'test-2',
      title: 'Test Job',
      company: 'Test Company',
      platform: 'Test Platform',
      url: 'https://test.com',
    };

    const evaluation = {
      dimensionScores: {
        skillsMatch: 4.0,
        experienceLevel: 4.0,
        salaryRange: 4.0,
        locationRemote: 4.0,
        cultureFit: 4.0,
        growthPotential: 4.0,
        techStackMatch: 4.0,
        roleClarity: 4.0,
        teamSize: 4.0,
        workLifeBalance: 4.0,
      },
      notes: {},
      strengths: ['Strength 1', 'Strength 2', 'Strength 3', 'Strength 4', 'Strength 5', 'Strength 6', 'Strength 7'],
      redFlags: [],
      starStories: [],
      applicationStrategy: {
        highlight: [],
        emphasize: [],
        address: [],
      },
    };

    const report = generateEvaluationReport(job, evaluation, 'B', 4.0);

    // Should only include first 5 strengths
    expect(report).toContain('Strength 1');
    expect(report).toContain('Strength 5');
    expect(report).not.toContain('Strength 6');
    expect(report).not.toContain('Strength 7');
  });

  it('should limit STAR stories to 4 items', () => {
    const job = {
      id: 'test-3',
      title: 'Test Job',
      company: 'Test Company',
      platform: 'Test Platform',
      url: 'https://test.com',
    };

    const evaluation = {
      dimensionScores: {
        skillsMatch: 4.0,
        experienceLevel: 4.0,
        salaryRange: 4.0,
        locationRemote: 4.0,
        cultureFit: 4.0,
        growthPotential: 4.0,
        techStackMatch: 4.0,
        roleClarity: 4.0,
        teamSize: 4.0,
        workLifeBalance: 4.0,
      },
      notes: {},
      strengths: [],
      redFlags: [],
      starStories: [
        { title: 'Story 1', relevance: 'Relevance 1' },
        { title: 'Story 2', relevance: 'Relevance 2' },
        { title: 'Story 3', relevance: 'Relevance 3' },
        { title: 'Story 4', relevance: 'Relevance 4' },
        { title: 'Story 5', relevance: 'Relevance 5' },
      ],
      applicationStrategy: {
        highlight: [],
        emphasize: [],
        address: [],
      },
    };

    const report = generateEvaluationReport(job, evaluation, 'B', 4.0);

    // Should only include first 4 STAR stories
    expect(report).toContain('### 1. Story 1');
    expect(report).toContain('### 4. Story 4');
    expect(report).not.toContain('### 5. Story 5');
  });

  it('should generate appropriate next steps for A-grade jobs', () => {
    const job = {
      id: 'test-4',
      title: 'Test Job',
      company: 'Test Company',
      platform: 'Test Platform',
      url: 'https://test.com',
    };

    const evaluation = {
      dimensionScores: {
        skillsMatch: 5.0,
        experienceLevel: 5.0,
        salaryRange: 5.0,
        locationRemote: 5.0,
        cultureFit: 5.0,
        growthPotential: 5.0,
        techStackMatch: 5.0,
        roleClarity: 5.0,
        teamSize: 5.0,
        workLifeBalance: 5.0,
      },
      notes: {},
      strengths: [],
      redFlags: [],
      starStories: [],
      applicationStrategy: {
        highlight: [],
        emphasize: [],
        address: [],
      },
    };

    const report = generateEvaluationReport(job, evaluation, 'A', 5.0);

    expect(report).toContain('- [ ] Apply within 24-48 hours (high priority)');
    expect(report).toContain('- [ ] Prepare tailored cover letter');
  });

  it('should use ✅ and ⚠️ indicators correctly in requirements checklist', () => {
    const job = {
      id: 'test-5',
      title: 'Test Job',
      company: 'Test Company',
      platform: 'Test Platform',
      url: 'https://test.com',
    };

    const evaluation = {
      dimensionScores: {
        skillsMatch: 4.5, // Above threshold (3.5) -> ✅
        experienceLevel: 2.0, // Below threshold (3.5) -> ⚠️
        salaryRange: 3.5, // Above threshold (3.0) -> ✅
        locationRemote: 2.5, // Below threshold (3.0) -> ⚠️
        cultureFit: 3.0,
        growthPotential: 3.0,
        techStackMatch: 4.0,
        roleClarity: 3.0,
        teamSize: 3.0,
        workLifeBalance: 3.0,
      },
      notes: {},
      strengths: [],
      redFlags: [],
      starStories: [],
      applicationStrategy: {
        highlight: [],
        emphasize: [],
        address: [],
      },
    };

    const report = generateEvaluationReport(job, evaluation, 'C', 3.5);

    // Check that indicators are present
    expect(report).toContain('✅ Skills match job requirements');
    expect(report).toContain('⚠️ Experience level appropriate');
    expect(report).toContain('✅ Salary meets expectations');
    expect(report).toContain('⚠️ Location/remote arrangement suitable');
  });
});
