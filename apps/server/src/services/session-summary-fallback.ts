import fs from 'node:fs/promises';
import path from 'node:path';
import type { SessionSummary } from './session-summary-builder.js';

const FALLBACK_DIR = path.join(
  import.meta.dirname ?? '.',
  '../../data/failed-summaries',
);

export async function writeSessionSummaryToDisk(
  sessionId: string,
  summary: SessionSummary,
): Promise<void> {
  const payload = {
    sessionId,
    writtenAt: new Date().toISOString(),
    summary,
  };

  try {
    await fs.mkdir(FALLBACK_DIR, { recursive: true });
    const filePath = path.join(FALLBACK_DIR, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), { flag: 'wx' });
    console.error(`[SessionSummaryFallback] Wrote fallback file: ${filePath}`);
  } catch (err) {
    console.error('[SessionSummaryFallback] Disk write also failed — logging full summary to stderr', err);
    console.error('[SessionSummaryFallback] Full summary JSON:', JSON.stringify(payload));
  }
}
