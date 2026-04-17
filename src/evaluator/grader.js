// ── Grade calculation
// Computes a weighted total score from 10 dimension scores
// and maps it to an A–F letter grade.

/**
 * Dimension weights for scoring.
 * All weights sum to 1.0.
 */
export const DIMENSION_WEIGHTS = {
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

/**
 * Calculates a weighted total score and letter grade from dimension scores.
 * @param {Record<string, number>} dimensionScores - Scores (0–5) keyed by dimension name.
 * @returns {{ grade: string, totalScore: number }}
 */
export function calculateGrade(dimensionScores) {
  let totalScore = 0;

  for (const [dimension, score] of Object.entries(dimensionScores)) {
    const weight = DIMENSION_WEIGHTS[dimension] || 0;
    totalScore += score * weight;
  }

  let grade;
  if (totalScore >= 4.5) grade = 'A';
  else if (totalScore >= 4.0) grade = 'B';
  else if (totalScore >= 3.5) grade = 'C';
  else if (totalScore >= 3.0) grade = 'D';
  else grade = 'F';

  return { grade, totalScore: Math.round(totalScore * 100) / 100 };
}
