import { describe, it, expect } from 'vitest';
import { containsMedicalLanguage } from '../../src/services/groqService.js';
import { getStaticRecommendation, getTemplateKeys } from '../../src/services/recommendationTemplates.js';

describe('Groq: medical language detection', () => {
  it('detects "diagnosis"', () => {
    expect(containsMedicalLanguage('You should seek a diagnosis from a professional.')).toBe(true);
  });
  it('detects "prescribe"', () => {
    expect(containsMedicalLanguage('Your doctor may prescribe medication.')).toBe(true);
  });
  it('detects "treatment"', () => {
    expect(containsMedicalLanguage('Consider treatment options for your condition.')).toBe(true);
  });
  it('detects "symptoms"', () => {
    expect(containsMedicalLanguage('Watch for symptoms of respiratory distress.')).toBe(true);
  });
  it('detects "medication"', () => {
    expect(containsMedicalLanguage('Continue taking your medication.')).toBe(true);
  });

  it('allows clean text about air quality', () => {
    expect(
      containsMedicalLanguage(
        'Air quality is elevated today. Consider reducing prolonged outdoor exertion and staying hydrated.',
      ),
    ).toBe(false);
  });

  it('allows practical advice text', () => {
    expect(
      containsMedicalLanguage(
        'Keep windows closed and use an air purifier. Wear an N95 mask if going outside.',
      ),
    ).toBe(false);
  });
});

describe('Static recommendation templates: completeness', () => {
  it('has all 18 templates', () => {
    expect(getTemplateKeys()).toHaveLength(18);
  });

  it('every template has summary and advice array', () => {
    const keys = getTemplateKeys();
    for (const key of keys) {
      const template = getStaticRecommendation(key);
      expect(template).not.toBeNull();
      expect(typeof template.summary).toBe('string');
      expect(template.summary.length).toBeGreaterThan(10);
      expect(Array.isArray(template.advice)).toBe(true);
      expect(template.advice.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns null for unknown key', () => {
    expect(getStaticRecommendation('unknown_key')).toBeNull();
  });
});
