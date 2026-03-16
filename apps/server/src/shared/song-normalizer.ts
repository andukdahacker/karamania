// Song normalization for cross-platform matching (YouTube ↔ Spotify)
// Used ONLY for overlap counting in the song pool — NOT for catalog ILIKE queries

// Note: `g` flag is safe here — these are only used with String.prototype.replace(),
// which does not persist lastIndex. Do NOT use with .test() or .exec() directly.
const SUFFIX_PATTERNS = [
  /\s*\(karaoke\s*(version)?\)\s*/gi,
  /\s*\(instrumental\)\s*/gi,
  /\s*\(with lyrics\)\s*/gi,
  /\s*\(official\s*(music\s*)?video\)\s*/gi,
  /\s*\(lyric video\)\s*/gi,
  /\s*\(audio\)\s*/gi,
  /\s*\(remix\)\s*/gi,
];

const FEAT_PATTERN = /\s*(feat\.|ft\.|featuring)\s+.+$/i;

export function normalizeSongTitle(title: string): string {
  let normalized = title.trim().toLowerCase();

  for (const pattern of SUFFIX_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }

  // Strip feat./ft./featuring + artist name from title
  normalized = normalized.replace(FEAT_PATTERN, '');

  // Strip trailing punctuation
  normalized = normalized.replace(/[.!?]+$/, '');

  // Collapse multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

export function normalizeArtist(artist: string): string {
  let normalized = artist.trim().toLowerCase();

  // Strip feat./ft./featuring suffixes
  normalized = normalized.replace(FEAT_PATTERN, '');

  // Extract primary artist: remove "& " and ", " delimiters
  // "Drake & Future" -> "drake", "Drake, Future" -> "drake"
  normalized = normalized.split(/\s*[&,]\s*/)[0]!;

  // Collapse multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

export function generateSongKey(title: string, artist: string): string {
  return `${normalizeSongTitle(title)}::${normalizeArtist(artist)}`;
}

export function songsMatch(
  a: { title: string; artist: string },
  b: { title: string; artist: string },
): boolean {
  return generateSongKey(a.title, a.artist) === generateSongKey(b.title, b.artist);
}
