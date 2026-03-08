import { randomInt } from 'node:crypto';
import { findByPartyCode } from '../persistence/session-repository.js';
import { internalError } from '../shared/errors.js';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePartyCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[randomInt(CHARS.length)];
  }
  return code;
}

export async function generateUniquePartyCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePartyCode();
    const existing = await findByPartyCode(code);
    if (!existing) return code;
  }
  const appError = internalError('Failed to generate unique party code');
  const error = new Error(appError.message);
  Object.assign(error, { code: appError.code, statusCode: appError.statusCode });
  throw error;
}
