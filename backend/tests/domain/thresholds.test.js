import { describe, it, expect } from 'vitest';
import {
  getHazardBand,
  getEpaCategory,
  isSensitiveProfile,
  EPA,
  BANDS,
} from '../../src/domain/thresholds.js';
import { calculateRollingAverage } from '../../src/domain/rollingAverage.js';

// ── All 18 rule-engine mappings ────────────────
// NOTE: Since the rolling 24-hour average was adopted, the PM2.5 values
// below represent *averaged* inputs — the hazard engine now receives
// 24-hour rolling averages, not raw hourly spikes.

describe('Thresholds: Healthy Adult — boundary tests with averaged PM2.5 (3 bands × 6 values)', () => {
  // Safe = Good + Moderate (0 – 35.4)
  it('PM2.5 = 0 → safe', () => {
    expect(getHazardBand(0, 'adult')).toBe(BANDS.SAFE);
  });
  it('PM2.5 = 9.0 (EPA Good max) → safe', () => {
    expect(getHazardBand(9.0, 'adult')).toBe(BANDS.SAFE);
  });
  it('PM2.5 = 9.1 (EPA Moderate start) → safe', () => {
    expect(getHazardBand(9.1, 'adult')).toBe(BANDS.SAFE);
  });
  it('PM2.5 = 35.4 (EPA Moderate max) → safe', () => {
    expect(getHazardBand(35.4, 'adult')).toBe(BANDS.SAFE);
  });

  // Caution = USG + Unhealthy (35.5 – 125.4)
  it('PM2.5 = 35.5 (EPA USG start) → caution', () => {
    expect(getHazardBand(35.5, 'adult')).toBe(BANDS.CAUTION);
  });
  it('PM2.5 = 55.4 (EPA USG max) → caution', () => {
    expect(getHazardBand(55.4, 'adult')).toBe(BANDS.CAUTION);
  });
  it('PM2.5 = 55.5 (EPA Unhealthy start) → caution', () => {
    expect(getHazardBand(55.5, 'adult')).toBe(BANDS.CAUTION);
  });
  it('PM2.5 = 125.4 (EPA Unhealthy max) → caution', () => {
    expect(getHazardBand(125.4, 'adult')).toBe(BANDS.CAUTION);
  });

  // Hazardous = Very Unhealthy + Hazardous (125.5+)
  it('PM2.5 = 125.5 → hazardous', () => {
    expect(getHazardBand(125.5, 'adult')).toBe(BANDS.HAZARDOUS);
  });
  it('PM2.5 = 225.4 → hazardous', () => {
    expect(getHazardBand(225.4, 'adult')).toBe(BANDS.HAZARDOUS);
  });
  it('PM2.5 = 225.5 → hazardous', () => {
    expect(getHazardBand(225.5, 'adult')).toBe(BANDS.HAZARDOUS);
  });
  it('PM2.5 = 500 → hazardous', () => {
    expect(getHazardBand(500, 'adult')).toBe(BANDS.HAZARDOUS);
  });
});

describe('Thresholds: Sensitive profiles — Child (categorical shift, averaged inputs)', () => {
  // Safe = Good only (0 – 9.0)
  it('PM2.5 = 0 → safe', () => {
    expect(getHazardBand(0, 'child')).toBe(BANDS.SAFE);
  });
  it('PM2.5 = 9.0 → safe', () => {
    expect(getHazardBand(9.0, 'child')).toBe(BANDS.SAFE);
  });

  // Caution = Moderate + USG (9.1 – 55.4)
  it('PM2.5 = 9.1 → caution (shifted one band earlier than Healthy Adult)', () => {
    expect(getHazardBand(9.1, 'child')).toBe(BANDS.CAUTION);
  });
  it('PM2.5 = 30 → caution (would be safe for healthy adult)', () => {
    expect(getHazardBand(30, 'child')).toBe(BANDS.CAUTION);
  });
  it('PM2.5 = 55.4 → caution', () => {
    expect(getHazardBand(55.4, 'child')).toBe(BANDS.CAUTION);
  });

  // Hazardous = Unhealthy and above (55.5+)
  it('PM2.5 = 55.5 → hazardous (shifted earlier)', () => {
    expect(getHazardBand(55.5, 'child')).toBe(BANDS.HAZARDOUS);
  });
  it('PM2.5 = 100 → hazardous', () => {
    expect(getHazardBand(100, 'child')).toBe(BANDS.HAZARDOUS);
  });
});

describe('Thresholds: All sensitive profiles share the same shifted thresholds (averaged inputs)', () => {
  const sensitiveProfiles = ['child', 'elderly', 'pregnant_woman', 'asthma_copd', 'outdoor_worker'];

  for (const profile of sensitiveProfiles) {
    it(`${profile}: PM2.5 = 9.0 → safe`, () => {
      expect(getHazardBand(9.0, profile)).toBe(BANDS.SAFE);
    });
    it(`${profile}: PM2.5 = 9.1 → caution`, () => {
      expect(getHazardBand(9.1, profile)).toBe(BANDS.CAUTION);
    });
    it(`${profile}: PM2.5 = 55.4 → caution`, () => {
      expect(getHazardBand(55.4, profile)).toBe(BANDS.CAUTION);
    });
    it(`${profile}: PM2.5 = 55.5 → hazardous`, () => {
      expect(getHazardBand(55.5, profile)).toBe(BANDS.HAZARDOUS);
    });
  }
});

describe('Thresholds: Invalid inputs', () => {
  it('rejects negative PM2.5', () => {
    expect(() => getHazardBand(-1, 'adult')).toThrow('Invalid PM2.5');
  });
  it('rejects NaN', () => {
    expect(() => getHazardBand(NaN, 'adult')).toThrow('Invalid PM2.5');
  });
  it('rejects non-number', () => {
    expect(() => getHazardBand('42', 'adult')).toThrow('Invalid PM2.5');
  });
});

describe('EPA category lookup', () => {
  it('PM2.5 = 5 → Good', () => {
    expect(getEpaCategory(5)).toBe('Good');
  });
  it('PM2.5 = 20 → Moderate', () => {
    expect(getEpaCategory(20)).toBe('Moderate');
  });
  it('PM2.5 = 40 → USG', () => {
    expect(getEpaCategory(40)).toBe('Unhealthy for Sensitive Groups');
  });
  it('PM2.5 = 80 → Unhealthy', () => {
    expect(getEpaCategory(80)).toBe('Unhealthy');
  });
  it('PM2.5 = 150 → Very Unhealthy', () => {
    expect(getEpaCategory(150)).toBe('Very Unhealthy');
  });
  it('PM2.5 = 300 → Hazardous', () => {
    expect(getEpaCategory(300)).toBe('Hazardous');
  });
});

describe('Profile classification', () => {
  it('adult is NOT sensitive', () => {
    expect(isSensitiveProfile('adult')).toBe(false);
  });
  it('child IS sensitive', () => {
    expect(isSensitiveProfile('child')).toBe(true);
  });
  it('asthma_copd IS sensitive', () => {
    expect(isSensitiveProfile('asthma_copd')).toBe(true);
  });
  it('outdoor_worker IS sensitive', () => {
    expect(isSensitiveProfile('outdoor_worker')).toBe(true);
  });
  it('unknown profile is not sensitive', () => {
    expect(isSensitiveProfile('alien')).toBe(false);
  });
});

// ── Averaged-input integration tests ───────────
// Demonstrate that the hazard engine classifies the *averaged* PM2.5,
// not a raw hourly spike.  A single high reading surrounded by
// normal readings gets smoothed down by the rolling average.

describe('Thresholds: classification uses averaged PM2.5, not raw spikes', () => {
  it('a single spike of 200 among 23 normal readings (30) averages to ~37.08 → caution for adult', () => {
    // 23 hours at 30, 1 hour at 200 → avg = (23*30 + 200) / 24 = 890/24 ≈ 37.08
    const values = [...Array(23).fill(30), 200];
    const now = Date.now();
    const readings = values.map((pm25, i) => ({
      pm25,
      timestamp: new Date(now - i * 3600_000),
    }));

    const avg = calculateRollingAverage(readings);
    // The raw spike of 200 would be hazardous for everyone,
    // but the averaged value (~37.08) is only caution for healthy adult.
    expect(avg.pm25).toBeCloseTo(37.08, 1);
    expect(getHazardBand(avg.pm25, 'adult')).toBe(BANDS.CAUTION);
  });

  it('sustained high readings average to hazardous even after smoothing', () => {
    // All 24 hours at 150 → avg = 150 → hazardous for adult
    const values = Array(24).fill(150);
    const now = Date.now();
    const readings = values.map((pm25, i) => ({
      pm25,
      timestamp: new Date(now - i * 3600_000),
    }));

    const avg = calculateRollingAverage(readings);
    expect(avg.pm25).toBe(150);
    expect(getHazardBand(avg.pm25, 'adult')).toBe(BANDS.HAZARDOUS);
  });

  it('warm-up period (partial window) still classifies correctly', () => {
    // Only 6 hours at 8 → avg = 8 → safe for adult
    const values = Array(6).fill(8);
    const now = Date.now();
    const readings = values.map((pm25, i) => ({
      pm25,
      timestamp: new Date(now - i * 3600_000),
    }));

    const avg = calculateRollingAverage(readings);
    expect(avg.pm25).toBe(8);
    expect(avg.isFullWindow).toBe(false);
    expect(getHazardBand(avg.pm25, 'adult')).toBe(BANDS.SAFE);
  });
});
