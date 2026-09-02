import { describe, it, expect } from 'vitest';
import {
  SEVERITY,
  getSeverityRank,
  isMoreSevere,
  mapBandToSeverity,
} from '../../src/domain/severity.js';

describe('Severity ordering', () => {
  it('info < caution < warning < danger', () => {
    expect(getSeverityRank('info')).toBeLessThan(getSeverityRank('caution'));
    expect(getSeverityRank('caution')).toBeLessThan(getSeverityRank('warning'));
    expect(getSeverityRank('warning')).toBeLessThan(getSeverityRank('danger'));
  });

  it('isMoreSevere works correctly', () => {
    expect(isMoreSevere('danger', 'info')).toBe(true);
    expect(isMoreSevere('info', 'danger')).toBe(false);
    expect(isMoreSevere('caution', 'caution')).toBe(false);
  });

  it('rejects unknown severity', () => {
    expect(() => getSeverityRank('unknown')).toThrow('Unknown severity');
  });
});

describe('Band → severity mapping', () => {
  it('safe → info', () => {
    expect(mapBandToSeverity('safe', 5)).toBe(SEVERITY.INFO);
  });

  it('caution → caution', () => {
    expect(mapBandToSeverity('caution', 50)).toBe(SEVERITY.CAUTION);
  });

  it('hazardous with PM2.5 < 225.5 → warning', () => {
    expect(mapBandToSeverity('hazardous', 150)).toBe(SEVERITY.WARNING);
  });

  it('hazardous with PM2.5 >= 225.5 → danger', () => {
    expect(mapBandToSeverity('hazardous', 225.5)).toBe(SEVERITY.DANGER);
    expect(mapBandToSeverity('hazardous', 300)).toBe(SEVERITY.DANGER);
  });
});
