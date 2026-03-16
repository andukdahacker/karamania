// In-memory Spin the Wheel round tracker — tracks wheel state per session
// Same module-level Map pattern as dj-state-store.ts, song-pool.ts, connection-tracker.ts, quick-pick.ts

export interface SpinWheelSegment {
  catalogTrackId: string;
  songTitle: string;
  artist: string;
  youtubeVideoId: string;
  overlapCount: number;
  segmentIndex: number;
}

export interface SpinWheelRound {
  sessionId: string;
  segments: SpinWheelSegment[];
  state: 'waiting' | 'spinning' | 'landed' | 'vetoing' | 'resolved';
  spinnerUserId: string | null;
  targetSegmentIndex: number | null;
  vetoUsed: boolean;
  vetoedSegmentIndex: number | null;
  startedAt: number;
  spinTimerHandle: ReturnType<typeof setTimeout> | null;
  vetoTimerHandle: ReturnType<typeof setTimeout> | null;
}

const rounds = new Map<string, SpinWheelRound>();

export function startRound(sessionId: string, segments: SpinWheelSegment[]): SpinWheelRound {
  const round: SpinWheelRound = {
    sessionId,
    segments,
    state: 'waiting',
    spinnerUserId: null,
    targetSegmentIndex: null,
    vetoUsed: false,
    vetoedSegmentIndex: null,
    startedAt: Date.now(),
    spinTimerHandle: null,
    vetoTimerHandle: null,
  };

  rounds.set(sessionId, round);
  return round;
}

function calculateSpinParams(
  segments: SpinWheelSegment[],
  targetSegmentIndex: number,
): { totalRotationRadians: number; spinDurationMs: number } {
  const segmentAngle = (2 * Math.PI) / segments.length;
  const fullRotations = Math.floor(Math.random() * 4) + 5; // 5-8 full rotations
  const targetOffset = targetSegmentIndex * segmentAngle;
  const totalRotationRadians = fullRotations * 2 * Math.PI + targetOffset;
  return { totalRotationRadians, spinDurationMs: 4000 };
}

export function initiateSpin(
  sessionId: string,
  spinnerUserId: string,
): { targetSegmentIndex: number; totalRotationRadians: number; spinDurationMs: number } | null {
  const round = rounds.get(sessionId);
  if (!round || round.state !== 'waiting') return null;

  const targetSegmentIndex = Math.floor(Math.random() * round.segments.length);
  const { totalRotationRadians, spinDurationMs } = calculateSpinParams(round.segments, targetSegmentIndex);

  round.state = 'spinning';
  round.targetSegmentIndex = targetSegmentIndex;
  round.spinnerUserId = spinnerUserId;

  return { targetSegmentIndex, totalRotationRadians, spinDurationMs };
}

export function onSpinComplete(sessionId: string): SpinWheelSegment | null {
  const round = rounds.get(sessionId);
  if (!round || round.state !== 'spinning' || round.targetSegmentIndex === null) return null;

  round.state = 'landed';
  return round.segments[round.targetSegmentIndex] ?? null;
}

export function startVetoWindow(sessionId: string): void {
  const round = rounds.get(sessionId);
  if (!round || round.state !== 'landed') return;
  round.state = 'vetoing';
}

export function handleVeto(
  sessionId: string,
  userId: string,
): {
  newTargetSegmentIndex: number;
  totalRotationRadians: number;
  spinDurationMs: number;
  vetoedSong: SpinWheelSegment;
} | null {
  const round = rounds.get(sessionId);
  if (!round || round.state !== 'vetoing' || round.vetoUsed) return null;
  if (round.targetSegmentIndex === null) return null;

  const vetoedSong = round.segments[round.targetSegmentIndex];
  if (!vetoedSong) return null;

  round.vetoUsed = true;
  round.vetoedSegmentIndex = round.targetSegmentIndex;

  // Pick new target from remaining segments (excluding vetoed)
  const remainingIndices = round.segments
    .map((_, i) => i)
    .filter(i => i !== round.vetoedSegmentIndex);

  if (remainingIndices.length === 0) return null;

  const newTargetSegmentIndex = remainingIndices[Math.floor(Math.random() * remainingIndices.length)]!;
  const { totalRotationRadians, spinDurationMs } = calculateSpinParams(round.segments, newTargetSegmentIndex);

  round.state = 'spinning';
  round.targetSegmentIndex = newTargetSegmentIndex;

  return { newTargetSegmentIndex, totalRotationRadians, spinDurationMs, vetoedSong };
}

export function resolveRound(sessionId: string): SpinWheelSegment | null {
  const round = rounds.get(sessionId);
  if (!round || round.targetSegmentIndex === null) return null;
  if (round.state !== 'landed' && round.state !== 'vetoing') return null;

  round.state = 'resolved';
  return round.segments[round.targetSegmentIndex] ?? null;
}

export function autoSpin(
  sessionId: string,
): { targetSegmentIndex: number; totalRotationRadians: number; spinDurationMs: number } | null {
  const round = rounds.get(sessionId);
  if (!round || round.state !== 'waiting') return null;

  const targetSegmentIndex = Math.floor(Math.random() * round.segments.length);
  const { totalRotationRadians, spinDurationMs } = calculateSpinParams(round.segments, targetSegmentIndex);

  round.state = 'spinning';
  round.targetSegmentIndex = targetSegmentIndex;
  round.spinnerUserId = null; // server-initiated

  return { targetSegmentIndex, totalRotationRadians, spinDurationMs };
}

export function getRound(sessionId: string): SpinWheelRound | undefined {
  return rounds.get(sessionId);
}

export function clearRound(sessionId: string): void {
  const round = rounds.get(sessionId);
  if (round) {
    if (round.spinTimerHandle) clearTimeout(round.spinTimerHandle);
    if (round.vetoTimerHandle) clearTimeout(round.vetoTimerHandle);
  }
  rounds.delete(sessionId);
}

export function resetAllRounds(): void {
  for (const round of rounds.values()) {
    if (round.spinTimerHandle) clearTimeout(round.spinTimerHandle);
    if (round.vetoTimerHandle) clearTimeout(round.vetoTimerHandle);
  }
  rounds.clear();
}
