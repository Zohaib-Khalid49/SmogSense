import { describe, it, expect } from 'vitest';
import { calculateConfidence, haversineKm, LEVELS, DISTANCE, FRESHNESS } from '../../src/domain/confidence.js';

describe('Confidence: distance-based tiers', () => {
  it('HIGH: 3 km station, fresh data, openaq source', () => {
    expect(
      calculateConfidence({
        distanceKm: 3,
        freshnessMs: 30 * 60 * 1000, // 30 min
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.HIGH);
  });

  it('HIGH: exactly at 5 km boundary', () => {
    expect(
      calculateConfidence({
        distanceKm: DISTANCE.HIGH_MAX_KM,
        freshnessMs: FRESHNESS.HIGH_MAX_MS,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.HIGH);
  });

  it('MEDIUM: 10 km station, 1.5 hr old data', () => {
    expect(
      calculateConfidence({
        distanceKm: 10,
        freshnessMs: 90 * 60 * 1000,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.MEDIUM);
  });

  it('MEDIUM: exactly at 15 km boundary', () => {
    expect(
      calculateConfidence({
        distanceKm: DISTANCE.MEDIUM_MAX_KM,
        freshnessMs: FRESHNESS.MEDIUM_MAX_MS,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.MEDIUM);
  });

  it('LOW: 25 km station', () => {
    expect(
      calculateConfidence({
        distanceKm: 25,
        freshnessMs: 2 * 60 * 60 * 1000,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.LOW);
  });

  it('LOW: station beyond 30 km', () => {
    expect(
      calculateConfidence({
        distanceKm: 50,
        freshnessMs: 30 * 60 * 1000,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.LOW);
  });

  it('LOW: data older than 3 hours', () => {
    expect(
      calculateConfidence({
        distanceKm: 3,
        freshnessMs: 4 * 60 * 60 * 1000,
        sources: ['openaq'],
      }),
    ).toBe(LEVELS.LOW);
  });
});

describe('Confidence: model_only and insufficient', () => {
  it('MODEL_ONLY: no station, only CAMS data', () => {
    expect(
      calculateConfidence({
        distanceKm: null,
        freshnessMs: 30 * 60 * 1000,
        sources: ['cams'],
      }),
    ).toBe(LEVELS.MODEL_ONLY);
  });

  it('INSUFFICIENT: no station, no CAMS', () => {
    expect(
      calculateConfidence({
        distanceKm: null,
        freshnessMs: 30 * 60 * 1000,
        sources: [],
      }),
    ).toBe(LEVELS.INSUFFICIENT);
  });

  it('INSUFFICIENT: no sources at all', () => {
    expect(
      calculateConfidence({
        distanceKm: null,
        freshnessMs: 0,
        sources: [],
      }),
    ).toBe(LEVELS.INSUFFICIENT);
  });
});

describe('Haversine distance', () => {
  it('calculates distance between two Lahore points (~3.84 km)', () => {
    const dist = haversineKm(31.52, 74.36, 31.55, 74.38);
    expect(dist).toBeGreaterThan(3);
    expect(dist).toBeLessThan(5);
  });

  it('same point = 0 km', () => {
    expect(haversineKm(31.52, 74.36, 31.52, 74.36)).toBe(0);
  });

  it('roughly correct for known distance (Lahore to Islamabad ~270 km)', () => {
    const dist = haversineKm(31.52, 74.36, 33.69, 73.04);
    expect(dist).toBeGreaterThan(250);
    expect(dist).toBeLessThan(300);
  });
});
