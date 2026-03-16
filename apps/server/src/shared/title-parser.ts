export function parseKaraokeTitle(title: string): { songTitle: string; artist: string } | null {
  // Strip common karaoke suffixes first
  let cleaned = title
    .replace(/\s*\|\s*Karaoke\s*(Version|With Lyrics|Instrumental)?\s*/gi, '')
    .replace(/\s*\(Karaoke\s*(Version)?\)\s*/gi, '')
    .replace(/\s*\(Instrumental\)\s*/gi, '')
    .replace(/\s*\(With Lyrics\)\s*/gi, '')
    .replace(/\s*\(Sing Along\)\s*/gi, '')
    .replace(/\s*-\s*Karaoke\s*(Version)?\s*$/gi, '')
    .trim();

  // Pattern 1: "Artist - Song" (require spaces around dash to avoid splitting hyphenated names like Jay-Z)
  let match = cleaned.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    const part1 = match[1]!.trim();
    const part2 = match[2]!.trim();
    if (part1 && part2) {
      return { artist: part1, songTitle: part2 };
    }
  }

  return null;
}
