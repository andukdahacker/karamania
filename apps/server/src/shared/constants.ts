export const VALID_VIBES = ['general', 'kpop', 'rock', 'ballad', 'edm'] as const;
export type Vibe = (typeof VALID_VIBES)[number];
export const DEFAULT_VIBE: Vibe = 'general';
