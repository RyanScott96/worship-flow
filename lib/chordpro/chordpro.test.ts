import { describe, expect, it } from 'vitest';
import { parse } from './parse';
import { serialize } from './serialize';
import { transposeDocument } from './transposeDocument';
import { toChordsAndLyricsText, toLyricsOnlyText, toNashvilleText, extractChordSequence } from './render';

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
});
