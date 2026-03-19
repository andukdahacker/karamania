// Group Sing-Along prompt pool and dealer — universally known songs for group singing moments
// Same module-level Map pattern as kings-cup-dealer.ts

export interface SingAlongPrompt {
  id: string;
  title: string;
  lyric: string;
  emoji: string;
}

export const SINGALONG_PROMPTS: readonly SingAlongPrompt[] = [
  { id: 'bohemian-rhapsody', title: 'Bohemian Rhapsody', lyric: 'Is this the real life? Is this just fantasy?', emoji: '🎸' },
  { id: 'dont-stop-believing', title: "Don't Stop Believin'", lyric: "Don't stop believin'! Hold on to that feelin'!", emoji: '🌟' },
  { id: 'we-will-rock-you', title: 'We Will Rock You', lyric: 'We will, we will rock you!', emoji: '🤘' },
  { id: 'sweet-caroline', title: 'Sweet Caroline', lyric: 'Sweet Caroline! Bah bah bah!', emoji: '🎶' },
  { id: 'somebody-that-i-used-to-know', title: 'Somebody That I Used To Know', lyric: "But you didn't have to cut me off!", emoji: '💔' },
  { id: 'dancing-queen', title: 'Dancing Queen', lyric: 'You are the dancing queen, young and sweet, only seventeen!', emoji: '👸' },
  { id: 'mr-brightside', title: 'Mr. Brightside', lyric: "Coming out of my cage and I've been doin' just fine!", emoji: '🔥' },
  { id: 'livin-on-a-prayer', title: "Livin' on a Prayer", lyric: "Woah, we're half way there!", emoji: '🙏' },
  { id: 'hey-jude', title: 'Hey Jude', lyric: 'Na na na na-na-na-na!', emoji: '🎵' },
  { id: 'we-are-the-champions', title: 'We Are the Champions', lyric: 'We are the champions, my friends!', emoji: '🏆' },
  { id: 'i-want-it-that-way', title: 'I Want It That Way', lyric: "Tell me why! Ain't nothin' but a heartache!", emoji: '💫' },
  { id: 'dont-stop-me-now', title: "Don't Stop Me Now", lyric: "I'm having such a good time, I'm having a ball!", emoji: '⚡' },
  { id: 'take-on-me', title: 'Take On Me', lyric: 'Take on me! Take me on!', emoji: '🎹' },
  { id: 'wonderwall', title: 'Wonderwall', lyric: "Because maybe, you're gonna be the one that saves me!", emoji: '🧱' },
  { id: 'shake-it-off', title: 'Shake It Off', lyric: "Shake it off, shake it off!", emoji: '💃' },
  { id: 'let-it-be', title: 'Let It Be', lyric: 'Let it be, let it be, let it be, let it be!', emoji: '🕊️' },
  { id: 'ymca', title: 'Y.M.C.A.', lyric: "It's fun to stay at the Y.M.C.A.!", emoji: '🏋️' },
  { id: 'livin-la-vida-loca', title: "Livin' La Vida Loca", lyric: "She's livin' la vida loca!", emoji: '🌶️' },
  { id: 'i-gotta-feeling', title: 'I Gotta Feeling', lyric: "I gotta feeling that tonight's gonna be a good night!", emoji: '🎉' },
  { id: 'happy', title: 'Happy', lyric: "Because I'm happy! Clap along if you feel like a room without a roof!", emoji: '😊' },
  { id: 'billie-jean', title: 'Billie Jean', lyric: 'Billie Jean is not my lover!', emoji: '🕺' },
  { id: 'eye-of-the-tiger', title: 'Eye of the Tiger', lyric: "It's the eye of the tiger, it's the thrill of the fight!", emoji: '🐯' },
];

// Track last dealt prompt per session to avoid immediate repeats
const lastDealtPrompt = new Map<string, string>();

/**
 * Deal a random prompt from the pool, avoiding immediate repeats per session.
 */
export function dealPrompt(sessionId: string): SingAlongPrompt {
  const lastId = lastDealtPrompt.get(sessionId);
  let eligible = SINGALONG_PROMPTS.filter(p => p.id !== lastId);

  // Fallback: if filtering leaves nothing (shouldn't happen with 22 prompts), use full pool
  if (eligible.length === 0) {
    eligible = [...SINGALONG_PROMPTS];
  }

  const index = Math.floor(Math.random() * eligible.length);
  const prompt = eligible[index]!;
  lastDealtPrompt.set(sessionId, prompt.id);
  return prompt;
}

/**
 * Clear last-dealt tracking for a session.
 */
export function clearSession(sessionId: string): void {
  lastDealtPrompt.delete(sessionId);
}

/**
 * Test utility — clear all session data.
 */
export function resetAll(): void {
  lastDealtPrompt.clear();
}
