import { describe, expect, it } from 'vitest';
import { parse } from './parse';
import { serialize } from './serialize';
import { transposeDocument } from './transposeDocument';
import {
  toChordsAndLyricsText,
  toLyricsOnlyText,
  toNashvilleText,
  nashvilleTransform,
  extractChordSequence,
  toPositionedSections,
} from './render';
import { toPositionedChart } from './positioned';

// The exact example from docs/DOMAIN.md §1.
const AMAZING_GRACE = `{title: Amazing Grace}
{key: G}
{tempo: 72}

{start_of_verse: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me
{end_of_verse}

{start_of_chorus}
[C]Praise the [G]Lord
{end_of_chorus}`;

describe('parse', () => {
  it('extracts metadata directives', () => {
    const doc = parse(AMAZING_GRACE);
    expect(doc.directives).toEqual({ title: 'Amazing Grace', key: 'G', tempo: '72' });
  });

  it('builds labeled verse and chorus sections', () => {
    const doc = parse(AMAZING_GRACE);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]).toMatchObject({ type: 'verse', label: 'Verse 1' });
    expect(doc.sections[1]).toMatchObject({ type: 'chorus', label: null });
  });

  it('splits chord+lyric lines into ordered segments', () => {
    const doc = parse(AMAZING_GRACE);
    expect(doc.sections[0].lines[0]).toEqual({
      kind: 'lyric',
      segments: [
        { chord: 'G', lyric: 'Amazing ' },
        { chord: 'G/B', lyric: 'grace, how ' },
        { chord: 'C', lyric: 'sweet the ' },
        { chord: 'G', lyric: 'sound' },
      ],
    });
  });

  it('never treats a capital letter in lyrics as a chord', () => {
    const doc = parse('[G]Sound the Alarm, King of the Ages');
    const segments = (doc.sections[0].lines[0] as { kind: 'lyric'; segments: unknown[] }).segments;
    // Only one chord in the whole line, despite several capitals in the lyric text.
    expect(segments).toEqual([{ chord: 'G', lyric: 'Sound the Alarm, King of the Ages' }]);
  });

  it('accepts short directive aliases', () => {
    const doc = parse('{sov}\n[C]La\n{c: watch the tempo}\n{eov}\n{soc: Chorus}\n[G]La\n{eoc}');
    expect(doc.sections[0]).toMatchObject({ type: 'verse', label: null });
    expect(doc.sections[0].lines[1]).toEqual({ kind: 'comment', text: 'watch the tempo' });
    expect(doc.sections[1]).toMatchObject({ type: 'chorus', label: 'Chorus' });
  });

  it('parses arbitrary metadata directives permissively', () => {
    const doc = parse('{ccli: 12345}\n[C]La');
    expect(doc.directives.ccli).toBe('12345');
  });
});

describe('serialize', () => {
  it('always emits the long directive form, even when short aliases were parsed', () => {
    const doc = parse('{sov}\n[C]La\n{eov}');
    expect(serialize(doc)).toContain('{start_of_verse}');
    expect(serialize(doc)).toContain('{end_of_verse}');
  });

  it('round-trips parse -> serialize -> parse to an equivalent document', () => {
    const doc = parse(AMAZING_GRACE);
    const reparsed = parse(serialize(doc));
    expect(reparsed).toEqual(doc);
  });
});

describe('transposeDocument', () => {
  it('transposes every chord and updates the key directive', () => {
    const doc = parse(AMAZING_GRACE);
    const transposed = transposeDocument(doc, 'A');
    expect(transposed.directives.key).toBe('A');
    expect(transposed.sections[0].lines[0]).toEqual({
      kind: 'lyric',
      segments: [
        { chord: 'A', lyric: 'Amazing ' },
        { chord: 'A/C#', lyric: 'grace, how ' },
        { chord: 'D', lyric: 'sweet the ' },
        { chord: 'A', lyric: 'sound' },
      ],
    });
  });

  it('does not mutate the original document', () => {
    const doc = parse(AMAZING_GRACE);
    transposeDocument(doc, 'A');
    expect(doc.directives.key).toBe('G');
  });

  it('throws when the document has no key directive', () => {
    const doc = parse('[C]La');
    expect(() => transposeDocument(doc, 'D')).toThrow(/no \{key\} directive/);
  });

  it('throws on an unusable target key rather than a bad chord', () => {
    const doc = parse('{key: C}\n[C]La');
    expect(() => transposeDocument(doc, 'H')).toThrow();
  });

  it('leaves a non-chord bracket alone instead of failing the whole document', () => {
    const doc = parse('{key: C}\n[C]walk on [N.C.]the [x2]water [G7sus4]home');
    const out = transposeDocument(doc, 'D');
    const chords = (out.sections[0].lines[0] as { segments: { chord: string | null }[] }).segments
      .map((s) => s.chord)
      .filter(Boolean);
    expect(chords).toEqual(['D', 'N.C.', 'x2', 'A7sus4']); // pitched tokens move, the rest ride along
  });
});

describe('render modes', () => {
  const doc = parse(AMAZING_GRACE);

  it('chords + lyrics', () => {
    expect(toChordsAndLyricsText(doc)).toBe(
      '[G]Amazing [G/B]grace, how [C]sweet the [G]sound\n' +
        'That [G]saved a [Em]wretch like [D]me\n\n' +
        '[C]Praise the [G]Lord'
    );
  });

  it('lyrics only', () => {
    expect(toLyricsOnlyText(doc)).toBe('Amazing grace, how sweet the sound\nThat saved a wretch like me\n\nPraise the Lord');
  });

  it('Nashville numbers', () => {
    expect(toNashvilleText(doc)).toBe(
      '[I]Amazing [I/iii]grace, how [IV]sweet the [I]sound\n' + 'That [I]saved a [vi]wretch like [V]me\n\n' + '[IV]Praise the [I]Lord'
    );
  });

  it('chords only, in order', () => {
    expect(extractChordSequence(doc)).toEqual(['G', 'G/B', 'C', 'G', 'G', 'Em', 'D', 'C', 'G']);
  });

  it('Nashville leaves a non-chord bracket as written instead of throwing', () => {
    const d = parse('{key: C}\n[C]hold [N.C.]then [G]go');
    expect(toNashvilleText(d)).toBe('[I]hold [N.C.]then [V]go');
  });
});

describe('nashvilleTransform', () => {
  const t = nashvilleTransform('C');
  it('maps a chord to its numeral', () => {
    expect(t('G')).toBe('V');
    expect(t('Am')).toBe('vi');
  });
  it('passes a non-chord bracket through unchanged', () => {
    expect(t('N.C.')).toBe('N.C.');
    expect(t('x2')).toBe('x2');
  });
});

describe('toPositionedSections', () => {
  it('mirrors the sections as chord/lyric cells, empty chord for a plain run', () => {
    const secs = toPositionedSections(parse(AMAZING_GRACE));
    expect(secs).toHaveLength(2);
    expect(secs[0]).toMatchObject({ type: 'verse', label: 'Verse 1' });
    expect(secs[0].lines[1]).toEqual({
      kind: 'lyric',
      cells: [
        { chord: '', lyric: 'That ' },
        { chord: 'G', lyric: 'saved a ' },
        { chord: 'Em', lyric: 'wretch like ' },
        { chord: 'D', lyric: 'me' },
      ],
    });
  });

  it('applies the chord transform and drops a chord when it returns null', () => {
    const secs = toPositionedSections(parse('[C]a [G]b [D]c'), (c) => (c === 'G' ? null : c.toLowerCase()));
    expect((secs[0].lines[0] as { cells: unknown[] }).cells).toEqual([
      { chord: 'c', lyric: 'a ' },
      { chord: '', lyric: 'b ' },
      { chord: 'd', lyric: 'c' },
    ]);
  });
});

describe('toPositionedChart', () => {
  it('transposes to the target key and positions', () => {
    const r = toPositionedChart(parse(AMAZING_GRACE), 'A');
    expect(r.error).toBeNull();
    expect((r.sections![0].lines[0] as { cells: { chord: string }[] }).cells[0].chord).toBe('A');
  });

  it('no target (or same key) -> renders as written', () => {
    expect(toPositionedChart(parse(AMAZING_GRACE), null).error).toBeNull();
    expect(toPositionedChart(parse(AMAZING_GRACE), 'G').error).toBeNull();
  });

  it('returns an error for a target key the app cannot resolve', () => {
    const r = toPositionedChart(parse(AMAZING_GRACE), 'H');
    expect(r.sections).toBeNull();
    expect(r.error).toMatch(/Couldn't put this chart in H/);
  });

  it('nashville: numerals for a resolvable key', () => {
    const r = toPositionedChart(parse(AMAZING_GRACE), null, 'nashville');
    expect(r.error).toBeNull();
    expect((r.sections![0].lines[0] as { cells: { chord: string }[] }).cells[0].chord).toBe('I');
  });

  it('nashville: error when the song has no key', () => {
    const r = toPositionedChart(parse('[C]la'), null, 'nashville');
    expect(r.sections).toBeNull();
    expect(r.error).toMatch(/no key set/);
  });

  it('nashville: error (not a throw) when {key} is unresolvable', () => {
    // valid chord, bad key -> toNashvilleNumber gets past parseChord to resolveKey
    const r = toPositionedChart(parse('{key: H}\n[G]la'), null, 'nashville');
    expect(r.sections).toBeNull();
    expect(r.error).toMatch(/isn't a key this app recognizes/);
  });
});
