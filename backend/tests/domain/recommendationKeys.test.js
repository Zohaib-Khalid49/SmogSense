import { describe, it, expect } from 'vitest';
import {
  getRecommendationKey,
  getAllRecommendationKeys,
  isValidRecommendationKey,
  PROFILE_CATEGORIES,
} from '../../src/domain/recommendationKeys.js';
import { BANDS } from '../../src/domain/thresholds.js';

describe('Recommendation keys: all 18 combinations', () => {
  it('generates exactly 18 keys', () => {
    expect(getAllRecommendationKeys()).toHaveLength(18);
  });

  it('all 18 keys are unique', () => {
    const keys = getAllRecommendationKeys();
    expect(new Set(keys).size).toBe(18);
  });

  const expectedKeys = [
    'safe_adult', 'safe_child', 'safe_elderly',
    'safe_pregnant_woman', 'safe_asthma_copd', 'safe_outdoor_worker',
    'caution_adult', 'caution_child', 'caution_elderly',
    'caution_pregnant_woman', 'caution_asthma_copd', 'caution_outdoor_worker',
    'hazardous_adult', 'hazardous_child', 'hazardous_elderly',
    'hazardous_pregnant_woman', 'hazardous_asthma_copd', 'hazardous_outdoor_worker',
  ];

  for (const key of expectedKeys) {
    it(`key "${key}" is valid`, () => {
      expect(isValidRecommendationKey(key)).toBe(true);
    });
  }

  it('builds correct key from band + profile', () => {
    expect(getRecommendationKey('caution', 'child')).toBe('caution_child');
    expect(getRecommendationKey('safe', 'adult')).toBe('safe_adult');
    expect(getRecommendationKey('hazardous', 'asthma_copd')).toBe('hazardous_asthma_copd');
    expect(getRecommendationKey('caution', 'outdoor_worker')).toBe('caution_outdoor_worker');
  });
});

describe('Recommendation keys: invalid inputs', () => {
  it('rejects unknown band', () => {
    expect(() => getRecommendationKey('danger', 'children')).toThrow('Unknown hazard band');
  });

  it('rejects unknown profile', () => {
    expect(() => getRecommendationKey('safe', 'alien')).toThrow('Unknown profile category');
  });

  it('isValidRecommendationKey returns false for garbage', () => {
    expect(isValidRecommendationKey('garbage')).toBe(false);
    expect(isValidRecommendationKey('')).toBe(false);
    expect(isValidRecommendationKey(null)).toBe(false);
    expect(isValidRecommendationKey(123)).toBe(false);
  });
});
