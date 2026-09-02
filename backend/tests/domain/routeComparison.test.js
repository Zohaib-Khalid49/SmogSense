import { describe, it, expect } from 'vitest';
import { compareRoutes, PM25_DIFF_THRESHOLD } from '../../src/domain/routeComparison.js';

describe('Route comparison: meaningful difference', () => {
  it('different bands + high confidence → meaningful difference', () => {
    const result = compareRoutes(
      { pm25: 42, confidence: 'high', profileCategory: 'adult' },
      { pm25: 18, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.meaningfulDifference).toBe(true);
    expect(result.reliable).toBe(true);
    expect(result.primaryBand).toBe('caution');
    expect(result.alternateBand).toBe('safe');
  });

  it('same band, small PM2.5 difference → no meaningful difference', () => {
    const result = compareRoutes(
      { pm25: 30, confidence: 'high', profileCategory: 'adult' },
      { pm25: 28, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.meaningfulDifference).toBe(false);
    expect(result.reliable).toBe(true);
  });

  it('same band, >15% difference → meaningful difference', () => {
    const result = compareRoutes(
      { pm25: 30, confidence: 'high', profileCategory: 'adult' },
      { pm25: 20, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.meaningfulDifference).toBe(true);
  });
});

describe('Route comparison: insufficient/model-only confidence', () => {
  it('insufficient confidence → unreliable comparison', () => {
    const result = compareRoutes(
      { pm25: 42, confidence: 'insufficient', profileCategory: 'adult' },
      { pm25: 18, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.reliable).toBe(false);
    expect(result.meaningfulDifference).toBe(false);
  });

  it('model_only confidence → unreliable comparison', () => {
    const result = compareRoutes(
      { pm25: 42, confidence: 'model_only', profileCategory: 'adult' },
      { pm25: 18, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.reliable).toBe(false);
    expect(result.meaningfulDifference).toBe(false);
  });

  it('both low confidence → unreliable even with big PM2.5 gap', () => {
    const result = compareRoutes(
      { pm25: 100, confidence: 'low', profileCategory: 'adult' },
      { pm25: 5, confidence: 'low', profileCategory: 'adult' },
    );
    expect(result.reliable).toBe(false);
    expect(result.meaningfulDifference).toBe(false);
    expect(result.advice).toContain('Insufficient data');
  });
});

describe('Route comparison: advice generation', () => {
  it('alternate is cleaner → suggests alternate', () => {
    const result = compareRoutes(
      { pm25: 42, confidence: 'high', profileCategory: 'adult' },
      { pm25: 5, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.advice).toContain('alternate');
  });

  it('primary is cleaner → suggests staying on primary', () => {
    const result = compareRoutes(
      { pm25: 5, confidence: 'high', profileCategory: 'adult' },
      { pm25: 42, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.advice).toContain('current route');
  });

  it('similar levels → suggests convenience', () => {
    const result = compareRoutes(
      { pm25: 30, confidence: 'high', profileCategory: 'adult' },
      { pm25: 29, confidence: 'high', profileCategory: 'adult' },
    );
    expect(result.advice).toContain('similar');
  });
});
