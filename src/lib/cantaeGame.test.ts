import { describe, it, expect } from 'vitest';
import { prepareLines, makeOptions, pointsForAttempt, readLyricsActivity } from './cantaeGame';
describe('Cantaê activity rules', () => {
  const lines = [{ en: 'Our little birds sing today', pt: 'Nossos passarinhos cantam hoje', start: 0 }];
  it('uses one or two missing words per line', () => {
    expect(prepareLines(lines, () => 0.1)[0].gaps).toHaveLength(1);
    expect(prepareLines(lines, () => 0.9)[0].gaps).toHaveLength(2);
  });
  it('offers exactly four distinct choices including the right word', () => {
    const options = makeOptions('birds', ['Birds', 'sing', 'sing', 'today']);
    expect(options).toHaveLength(4);
    expect(new Set(options.map(w => w.toLowerCase())).size).toBe(4);
    expect(options).toContain('birds');
  });
  it('awards fewer points per attempt and zero on the fourth click', () => {
    expect([1, 2, 3, 4].map(pointsForAttempt)).toEqual([100, 60, 30, 0]);
  });
  it('keeps the supplied full line shared by reading and gameplay', () => {
    expect(prepareLines(lines)[0].words.join(' ')).toBe(lines[0].en);
  });
  it('rejects missing translations and non-increasing timestamps', () => {
    expect(readLyricsActivity({ youtube_url: 'x', lines: [{ ...lines[0], pt: '' }] })).toBeNull();
    expect(readLyricsActivity({ youtube_url: 'x', lines: [...lines, ...lines] })).toBeNull();
  });
});