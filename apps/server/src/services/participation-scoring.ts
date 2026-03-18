export const ParticipationTier = {
  passive: 'passive',
  active: 'active',
  engaged: 'engaged',
} as const;
export type ParticipationTier = (typeof ParticipationTier)[keyof typeof ParticipationTier];

export const TIER_POINTS: Record<ParticipationTier, number> = {
  passive: 1,
  active: 3,
  engaged: 5,
};

export const ACTION_TIER_MAP: Record<string, ParticipationTier> = {
  // Passive (1pt) — presence/viewing actions
  'party:joined': ParticipationTier.passive,
  'session:present': ParticipationTier.passive,

  // Passive (1pt) — lightstick mode
  'lightstick:toggled': ParticipationTier.passive,

  // Active (3pts) — lightweight engagement
  'party:vibeChanged': ParticipationTier.active,
  'reaction:sent': ParticipationTier.active,
  'sound:play': ParticipationTier.active,
  'hype:fired': ParticipationTier.active,

  // Active (3pts) — interlude voting
  'interlude:vote': ParticipationTier.active,

  // Engaged (5pts) — meaningful participation
  'card:accepted': ParticipationTier.engaged,
  'card:completed': ParticipationTier.engaged,
  'song:queued': ParticipationTier.engaged,
};

export function calculateScoreIncrement(
  action: string,
  rewardMultiplier: number = 1.0
): number {
  const tier = ACTION_TIER_MAP[action];
  if (!tier) return 0;
  const points = TIER_POINTS[tier];
  return Math.round(points * rewardMultiplier);
}
