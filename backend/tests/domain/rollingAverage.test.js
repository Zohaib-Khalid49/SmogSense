import { describe, it, expect } from 'vitest';
import {
  calculateRollingAverage,
  getAverageConfidence,
  FULL_WINDOW_HOURS,
  FULL_WINDOW_MS,
} from '../../src/domain/rollingAverage.js';

// ── Helpers ───────────────────────────────────

/**
 * Build an array of hourly readings with known PM2.5 values.
 * Most recent reading first (index 0 = now, index n = n hours ago).
 */
function buildReadings(pm25Values) {
  const now = Date.now();
  return pm25Values.map((pm25, i) => ({
    pm25,
    timestamp: new Date(now - i * 3600_000),
  }));
}

// ── Sequence / correctness ────────────────────

describe('Rolling Average: known-sequence correctness', () => {
  it('averages 24 identical values to the same value', () => {
    const readings = buildReadings(Array(24).fill(50));
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(50);
    expect(result.hoursUsed).toBe(24);
    expect(result.isFullWindow).toBe(true);
  });

  it('averages a known sequence of 24 values correctly', () => {
    // Values 1..24 → sum = 300, avg = 12.5
    const values = Array.from({ length: 24 }, (_, i) => i + 1);
    const readings = buildReadings(values);
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(12.5);
    expect(result.hoursUsed).toBe(24);
    expect(result.isFullWindow).toBe(true);
  });

  it('takes only the 24 most recent when more than 24 are provided', () => {
    // 30 readings; the newest 24 have values 1..24 (avg 12.5)
    // The older 6 have value 999 and should be excluded
    const values = [...Array.from({ length: 24 }, (_, i) => i + 1), ...Array(6).fill(999)];
    const readings = buildReadings(values);
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(12.5);
    expect(result.hoursUsed).toBe(24);
    expect(result.isFullWindow).toBe(true);
  });

  it('running average recalculates as new readings arrive', () => {
    // Simulate 3 hours of data arriving sequentially
    const hour1 = calculateRollingAverage(buildReadings([40]));
    expect(hour1.pm25).toBe(40);
    expect(hour1.hoursUsed).toBe(1);

    const hour2 = calculateRollingAverage(buildReadings([40, 60]));
    expect(hour2.pm25).toBe(50);
    expect(hour2.hoursUsed).toBe(2);

    const hour3 = calculateRollingAverage(buildReadings([40, 60, 80]));
    expect(hour3.pm25).toBe(60);
    expect(hour3.hoursUsed).toBe(3);
  });

  it('rounds the result to two decimal places', () => {
    // 3 readings: 10, 20, 30 → avg = 20.0
    // 3 readings: 10, 20, 31 → avg = 20.333...
    const readings = buildReadings([10, 20, 31]);
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(20.33);
  });
});

// ── Warm-up period ────────────────────────────

describe('Rolling Average: warm-up period (fewer than 24 hours)', () => {
  it('computes average over 1 reading with isFullWindow=false', () => {
    const result = calculateRollingAverage(buildReadings([75]));

    expect(result.pm25).toBe(75);
    expect(result.hoursUsed).toBe(1);
    expect(result.isFullWindow).toBe(false);
  });

  it('computes average over 12 readings with isFullWindow=false', () => {
    const values = Array(12).fill(100);
    const result = calculateRollingAverage(buildReadings(values));

    expect(result.pm25).toBe(100);
    expect(result.hoursUsed).toBe(12);
    expect(result.isFullWindow).toBe(false);
  });

  it('computes average over 23 readings with isFullWindow=false', () => {
    const values = Array(23).fill(50);
    const result = calculateRollingAverage(buildReadings(values));

    expect(result.pm25).toBe(50);
    expect(result.hoursUsed).toBe(23);
    expect(result.isFullWindow).toBe(false);
  });

  it('flips to isFullWindow=true at exactly 24 readings', () => {
    const values = Array(24).fill(50);
    const result = calculateRollingAverage(buildReadings(values));

    expect(result.isFullWindow).toBe(true);
    expect(result.hoursUsed).toBe(24);
  });
});

// ── Edge cases ────────────────────────────────

describe('Rolling Average: edge cases', () => {
  it('returns null pm25 for empty array', () => {
    const result = calculateRollingAverage([]);

    expect(result.pm25).toBeNull();
    expect(result.hoursUsed).toBe(0);
    expect(result.isFullWindow).toBe(false);
    expect(result.oldestReading).toBeNull();
    expect(result.newestReading).toBeNull();
  });

  it('returns null pm25 for non-array input', () => {
    const result = calculateRollingAverage(null);

    expect(result.pm25).toBeNull();
    expect(result.hoursUsed).toBe(0);
  });

  it('returns null pm25 when all readings have invalid pm25', () => {
    const readings = [
      { pm25: NaN, timestamp: new Date() },
      { pm25: 'bad', timestamp: new Date() },
      { pm25: null, timestamp: new Date() },
      { pm25: undefined, timestamp: new Date() },
    ];
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBeNull();
    expect(result.hoursUsed).toBe(0);
  });

  it('filters out readings with missing timestamps', () => {
    const readings = [
      { pm25: 50, timestamp: new Date() },
      { pm25: 100, timestamp: null },
      { pm25: 75, timestamp: new Date() },
    ];
    const result = calculateRollingAverage(readings);

    // Only the 2 valid readings should be used
    expect(result.pm25).toBe(62.5);
    expect(result.hoursUsed).toBe(2);
  });

  it('handles PM2.5 = 0 correctly (valid zero)', () => {
    const readings = buildReadings([0, 0, 0]);
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(0);
    expect(result.hoursUsed).toBe(3);
  });

  it('handles very large PM2.5 values', () => {
    const readings = buildReadings([500, 500, 500]);
    const result = calculateRollingAverage(readings);

    expect(result.pm25).toBe(500);
  });

  it('records oldest and newest reading timestamps', () => {
    const readings = buildReadings([10, 20, 30]);
    const result = calculateRollingAverage(readings);

    expect(result.newestReading).toBeInstanceOf(Date);
    expect(result.oldestReading).toBeInstanceOf(Date);
    // newest should be more recent than oldest
    expect(result.newestReading.getTime()).toBeGreaterThan(result.oldestReading.getTime());
  });

  it('windowHours is always 24 regardless of input size', () => {
    const result1 = calculateRollingAverage(buildReadings([50]));
    const result2 = calculateRollingAverage(buildReadings(Array(48).fill(50)));

    expect(result1.windowHours).toBe(FULL_WINDOW_HOURS);
    expect(result2.windowHours).toBe(FULL_WINDOW_HOURS);
  });
});

// ── getAverageConfidence ──────────────────────

describe('getAverageConfidence', () => {
  it("returns 'none' when avgResult is null", () => {
    expect(getAverageConfidence(null)).toBe('none');
  });

  it("returns 'none' when pm25 is null (no data)", () => {
    const result = calculateRollingAverage([]);
    expect(getAverageConfidence(result)).toBe('none');
  });

  it("returns 'minimal' for 1–11 hours of data", () => {
    for (const hours of [1, 5, 11]) {
      const result = calculateRollingAverage(buildReadings(Array(hours).fill(50)));
      expect(getAverageConfidence(result)).toBe('minimal');
    }
  });

  it("returns 'partial' for 12–23 hours of data", () => {
    for (const hours of [12, 18, 23]) {
      const result = calculateRollingAverage(buildReadings(Array(hours).fill(50)));
      expect(getAverageConfidence(result)).toBe('partial');
    }
  });

  it("returns 'full' for 24 hours of data", () => {
    const result = calculateRollingAverage(buildReadings(Array(24).fill(50)));
    expect(getAverageConfidence(result)).toBe('full');
  });
});

// ── Constants export ──────────────────────────

describe('Rolling Average: exported constants', () => {
  it('FULL_WINDOW_HOURS is 24', () => {
    expect(FULL_WINDOW_HOURS).toBe(24);
  });

  it('FULL_WINDOW_MS is 86400000 (24h in milliseconds)', () => {
    expect(FULL_WINDOW_MS).toBe(86_400_000);
  });
});
