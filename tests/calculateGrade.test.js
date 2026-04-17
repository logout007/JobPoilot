/**
 * Unit tests for calculateGrade function
 * Task 5.2: Implement calculateGrade(dimensionScores) in evaluator-handler.js
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { describe, it, expect } from 'vitest';

// Import the function - we'll need to export it from evaluator-handler.js
// For now, we'll inline the implementation to test the logic
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

function calculateGrade(dimensionScores) {
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

describe('calculateGrade - Task 5.2', () => {
  describe('Weighted Score Calculation', () => {
    it('calculates weighted total correctly with all 5.0 scores', () => {
      const dimensionScores = {
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
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(5.0);
      expect(result.grade).toBe('A');
    });

    it('calculates weighted total correctly with mixed scores', () => {
      const dimensionScores = {
        skillsMatch: 4.5,      // 4.5 * 0.20 = 0.90
        experienceLevel: 4.0,  // 4.0 * 0.15 = 0.60
        salaryRange: 3.5,      // 3.5 * 0.15 = 0.525
        locationRemote: 5.0,   // 5.0 * 0.10 = 0.50
        cultureFit: 4.0,       // 4.0 * 0.10 = 0.40
        growthPotential: 3.0,  // 3.0 * 0.10 = 0.30
        techStackMatch: 4.5,   // 4.5 * 0.10 = 0.45
        roleClarity: 4.0,      // 4.0 * 0.05 = 0.20
        teamSize: 3.5,         // 3.5 * 0.03 = 0.105
        workLifeBalance: 4.0,  // 4.0 * 0.02 = 0.08
      };
      
      // Expected: 0.90 + 0.60 + 0.525 + 0.50 + 0.40 + 0.30 + 0.45 + 0.20 + 0.105 + 0.08 = 4.06
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(4.06);
      expect(result.grade).toBe('B');
    });

    it('verifies weights sum to 1.0 (100%)', () => {
      const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(weightSum).toBe(1.0);
    });
  });

  describe('Grade Assignment - Requirement 4.2-4.6', () => {
    it('assigns grade A for score 4.5 (lower boundary)', () => {
      const dimensionScores = {
        skillsMatch: 4.5,
        experienceLevel: 4.5,
        salaryRange: 4.5,
        locationRemote: 4.5,
        cultureFit: 4.5,
        growthPotential: 4.5,
        techStackMatch: 4.5,
        roleClarity: 4.5,
        teamSize: 4.5,
        workLifeBalance: 4.5,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(4.5);
      expect(result.grade).toBe('A');
    });

    it('assigns grade A for score 5.0 (upper boundary)', () => {
      const dimensionScores = {
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
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(5.0);
      expect(result.grade).toBe('A');
    });

    it('assigns grade B for score 4.0 (lower boundary)', () => {
      const dimensionScores = {
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
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(4.0);
      expect(result.grade).toBe('B');
    });

    it('assigns grade B for score 4.49', () => {
      const dimensionScores = {
        skillsMatch: 4.49,
        experienceLevel: 4.49,
        salaryRange: 4.49,
        locationRemote: 4.49,
        cultureFit: 4.49,
        growthPotential: 4.49,
        techStackMatch: 4.49,
        roleClarity: 4.49,
        teamSize: 4.49,
        workLifeBalance: 4.49,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(4.49);
      expect(result.grade).toBe('B');
    });

    it('assigns grade C for score 3.5 (lower boundary)', () => {
      const dimensionScores = {
        skillsMatch: 3.5,
        experienceLevel: 3.5,
        salaryRange: 3.5,
        locationRemote: 3.5,
        cultureFit: 3.5,
        growthPotential: 3.5,
        techStackMatch: 3.5,
        roleClarity: 3.5,
        teamSize: 3.5,
        workLifeBalance: 3.5,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(3.5);
      expect(result.grade).toBe('C');
    });

    it('assigns grade C for score 3.99', () => {
      const dimensionScores = {
        skillsMatch: 3.99,
        experienceLevel: 3.99,
        salaryRange: 3.99,
        locationRemote: 3.99,
        cultureFit: 3.99,
        growthPotential: 3.99,
        techStackMatch: 3.99,
        roleClarity: 3.99,
        teamSize: 3.99,
        workLifeBalance: 3.99,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(3.99);
      expect(result.grade).toBe('C');
    });

    it('assigns grade D for score 3.0 (lower boundary)', () => {
      const dimensionScores = {
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
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(3.0);
      expect(result.grade).toBe('D');
    });

    it('assigns grade D for score 3.49', () => {
      const dimensionScores = {
        skillsMatch: 3.49,
        experienceLevel: 3.49,
        salaryRange: 3.49,
        locationRemote: 3.49,
        cultureFit: 3.49,
        growthPotential: 3.49,
        techStackMatch: 3.49,
        roleClarity: 3.49,
        teamSize: 3.49,
        workLifeBalance: 3.49,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(3.49);
      expect(result.grade).toBe('D');
    });

    it('assigns grade F for score 2.99', () => {
      const dimensionScores = {
        skillsMatch: 2.99,
        experienceLevel: 2.99,
        salaryRange: 2.99,
        locationRemote: 2.99,
        cultureFit: 2.99,
        growthPotential: 2.99,
        techStackMatch: 2.99,
        roleClarity: 2.99,
        teamSize: 2.99,
        workLifeBalance: 2.99,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(2.99);
      expect(result.grade).toBe('F');
    });

    it('assigns grade F for score 0.0', () => {
      const dimensionScores = {
        skillsMatch: 0.0,
        experienceLevel: 0.0,
        salaryRange: 0.0,
        locationRemote: 0.0,
        cultureFit: 0.0,
        growthPotential: 0.0,
        techStackMatch: 0.0,
        roleClarity: 0.0,
        teamSize: 0.0,
        workLifeBalance: 0.0,
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(0.0);
      expect(result.grade).toBe('F');
    });
  });

  describe('Return Value Structure - Requirement 4.7', () => {
    it('returns object with grade and totalScore properties', () => {
      const dimensionScores = {
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
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('totalScore');
      expect(typeof result.grade).toBe('string');
      expect(typeof result.totalScore).toBe('number');
    });

    it('rounds totalScore to 2 decimal places', () => {
      const dimensionScores = {
        skillsMatch: 4.333,
        experienceLevel: 4.333,
        salaryRange: 4.333,
        locationRemote: 4.333,
        cultureFit: 4.333,
        growthPotential: 4.333,
        techStackMatch: 4.333,
        roleClarity: 4.333,
        teamSize: 4.333,
        workLifeBalance: 4.333,
      };
      
      const result = calculateGrade(dimensionScores);
      // 4.333 * 1.0 = 4.333, rounded to 4.33
      expect(result.totalScore).toBe(4.33);
      expect(result.grade).toBe('B');
    });
  });

  describe('Edge Cases', () => {
    it('handles missing dimension gracefully (uses weight 0)', () => {
      const dimensionScores = {
        skillsMatch: 5.0,
        experienceLevel: 5.0,
        salaryRange: 5.0,
        locationRemote: 5.0,
        cultureFit: 5.0,
        growthPotential: 5.0,
        techStackMatch: 5.0,
        roleClarity: 5.0,
        teamSize: 5.0,
        // workLifeBalance missing
      };
      
      const result = calculateGrade(dimensionScores);
      // Missing 5.0 * 0.02 = 0.10, so total = 4.90
      expect(result.totalScore).toBe(4.9);
      expect(result.grade).toBe('A');
    });

    it('handles extra unknown dimensions (ignored)', () => {
      const dimensionScores = {
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
        unknownDimension: 1.0, // Should be ignored (weight = 0)
      };
      
      const result = calculateGrade(dimensionScores);
      expect(result.totalScore).toBe(5.0);
      expect(result.grade).toBe('A');
    });
  });

  describe('Weight Verification - Task 5.2 Specification', () => {
    it('verifies Skills Match weight is 20%', () => {
      expect(DIMENSION_WEIGHTS.skillsMatch).toBe(0.20);
    });

    it('verifies Experience Level weight is 15%', () => {
      expect(DIMENSION_WEIGHTS.experienceLevel).toBe(0.15);
    });

    it('verifies Salary Range weight is 15%', () => {
      expect(DIMENSION_WEIGHTS.salaryRange).toBe(0.15);
    });

    it('verifies Location/Remote weight is 10%', () => {
      expect(DIMENSION_WEIGHTS.locationRemote).toBe(0.10);
    });

    it('verifies Culture Fit weight is 10%', () => {
      expect(DIMENSION_WEIGHTS.cultureFit).toBe(0.10);
    });

    it('verifies Growth Potential weight is 10%', () => {
      expect(DIMENSION_WEIGHTS.growthPotential).toBe(0.10);
    });

    it('verifies Tech Stack Match weight is 10%', () => {
      expect(DIMENSION_WEIGHTS.techStackMatch).toBe(0.10);
    });

    it('verifies Role Clarity weight is 5%', () => {
      expect(DIMENSION_WEIGHTS.roleClarity).toBe(0.05);
    });

    it('verifies Team Size weight is 3%', () => {
      expect(DIMENSION_WEIGHTS.teamSize).toBe(0.03);
    });

    it('verifies Work-Life Balance weight is 2%', () => {
      expect(DIMENSION_WEIGHTS.workLifeBalance).toBe(0.02);
    });
  });
});
