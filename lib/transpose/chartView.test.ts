import { describe, expect, it } from 'vitest';
import { resolveChartView } from './chartView';

describe('resolveChartView', () => {
  it('uses the override key over the source key', () => {
    expect(resolveChartView({ sourceKey: 'G', overrideKey: 'A' })).toEqual({
      soundingKey: 'A',
      shapeKey: null,
      capoLabel: 'Play in A',
    });
  });

  it('falls back to the source key when there is no override', () => {
    expect(resolveChartView({ sourceKey: 'G', overrideKey: null }).soundingKey).toBe('G');
  });

  it('resolves the shape key and label for a capo', () => {
    // Capo 3, sounding in Bb -> finger G shapes (DOMAIN.md §4).
    expect(resolveChartView({ sourceKey: 'Bb', capo: 3 })).toEqual({
      soundingKey: 'Bb',
      shapeKey: 'G',
      capoLabel: 'Capo 3 · play in G · sounds in Bb',
    });
  });

  it('treats a zero / null capo as no capo', () => {
    expect(resolveChartView({ sourceKey: 'G', capo: 0 }).shapeKey).toBeNull();
    expect(resolveChartView({ sourceKey: 'G', capo: null }).shapeKey).toBeNull();
  });

  it('returns all-null when no key is known', () => {
    expect(resolveChartView({ sourceKey: null, overrideKey: null, capo: 3 })).toEqual({
      soundingKey: null,
      shapeKey: null,
      capoLabel: null,
    });
  });

  it('never throws on an unknown key — nulls the capo math, keeps the sounding key', () => {
    expect(resolveChartView({ sourceKey: 'H', capo: 2 })).toEqual({
      soundingKey: 'H',
      shapeKey: null,
      capoLabel: null,
    });
  });
});
