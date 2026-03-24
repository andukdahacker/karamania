import http from 'k6/http';

/**
 * Authenticate as a guest participant via the REST API.
 *
 * @param {string} serverUrl  - Base URL, e.g. "http://localhost:3000"
 * @param {string} partyCode  - 6-character party code
 * @param {string} displayName - Display name for the guest
 * @returns {{ token: string, guestId: string, sessionId: string, vibe: string, status: string }}
 */
export function guestAuth(serverUrl, partyCode, displayName) {
  const res = http.post(
    `${serverUrl}/api/auth/guest`,
    JSON.stringify({ partyCode, displayName }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 200) {
    console.error(
      `Guest auth failed: ${res.status} — ${res.body}`,
    );
    return null;
  }

  const body = JSON.parse(res.body);
  return body.data; // { token, guestId, sessionId, vibe, status }
}
