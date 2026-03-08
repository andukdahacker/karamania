# Story 1.6: Party Join Flow & Live Lobby

Status: ready-for-dev

## Story

As a guest,
I want to join a party by entering a code and my name, then see who else is in the party,
so that I feel connected to the group before the party starts.

## Acceptance Criteria

1. **Given** a guest has the party code (from QR deep-link or manual entry)
   **When** they enter a display name and tap "Join"
   **Then** visual feedback appears within 200ms showing party status and player count before WebSocket is fully established (FR53)
   **And** the WebSocket connection is established and the guest joins the party session
   **And** all participants see a live party lobby showing who has joined and the current player count (FR4)
   **And** the lobby updates in real-time as new participants join
   **And** no text input is required beyond the display name (NFR15)
   **And** the join screen is usable on first encounter without instructions (NFR16)

2. **Given** fewer than 3 players are in the party
   **When** the lobby is displayed
   **Then** a waiting state shows current player count, QR code, and a share prompt to invite more participants (FR8)

3. **Given** no personally identifiable information is stored for guest users beyond display name and session participation data (NFR22)

## Tasks / Subtasks

- [ ] Task 1: Add `joinParty` method to `ApiClient` (AC: #1)
  - [ ] 1.1: Add `guestAuth()` method to `lib/api/api_client.dart`:
    ```dart
    Future<Map<String, dynamic>> guestAuth({
      required String displayName,
      required String partyCode,
    })
    ```
    - POST to `$baseUrl/api/auth/guest`
    - Body: `{ "displayName": displayName, "partyCode": partyCode }`
    - Returns `data` object: `{ token, guestId, sessionId }`
    - On 404 → throw `ApiException` with user-friendly message (party not found)
    - On 400 → throw `ApiException` with validation error
    - On 403 (session full) → throw `ApiException` with "Party is full" message
    - Follow existing `createSession()` pattern exactly (same error handling shape)

- [ ] Task 2: Add `joinParty` method to `SocketClient` (AC: #1)
  - [ ] 2.1: Add `joinParty()` to `lib/socket/client.dart`:
    ```dart
    Future<void> joinParty({
      required ApiClient apiClient,
      required AuthProvider authProvider,
      required PartyProvider partyProvider,
      required String serverUrl,
      required String displayName,
      required String partyCode,
    })
    ```
    **Flow** (mirrors `createParty()` pattern):
    1. Set `partyProvider.onJoinPartyLoading(LoadingState.loading)`
    2. Call `apiClient.guestAuth(displayName: displayName, partyCode: partyCode)`
    3. Extract `token`, `guestId`, `sessionId`, `vibe` from response
    4. Call `authProvider.onGuestAuthenticated(token, guestId, displayName)`
    5. Parse vibe string to `PartyVibe` enum (e.g., `PartyVibe.values.byName(vibeString)`)
    6. Call `partyProvider.onPartyJoined(sessionId: sessionId, partyCode: partyCode, vibe: parsedVibe)`
    7. Call `connect(serverUrl: serverUrl, token: token, sessionId: sessionId, displayName: displayName)`
    8. On error: set `partyProvider.onJoinPartyLoading(LoadingState.error)`, rethrow

  - [ ] 2.2: **IMPORTANT**: The existing `POST /api/auth/guest` response returns `{ token, guestId }` but does NOT return `sessionId`. Two options:
    - **Option A (Recommended)**: Update server `POST /api/auth/guest` to also return `sessionId` in the response. This is a minor server change in `routes/auth.ts` — the session is already looked up by `findByPartyCode()`, just include `session.id` in the response.
    - **Option B**: Decode the JWT on the client to extract `sessionId` from claims. This works since the guest token includes `sessionId` in its payload (see `services/guest-token.ts`), but decoding JWT on client without verification is less clean.
    - Choose Option A — add `sessionId` to auth response.

  - [ ] 2.3: Register `party:joined` listener in `connect()` method or a new `_setupPartyListeners()` method:
    ```dart
    void _setupPartyListeners(PartyProvider partyProvider) {
      on('party:joined', (data) {
        final Map<String, dynamic> payload = data as Map<String, dynamic>;
        partyProvider.onParticipantJoined(
          userId: payload['userId'] as String,
          displayName: payload['displayName'] as String,
          participantCount: payload['participantCount'] as int,
        );
      });
    }
    ```
    Call `_setupPartyListeners()` at the end of `connect()` after socket is established.
    **CRITICAL**: Also set up this listener in `createParty()` flow so the HOST also receives party:joined events.

- [ ] Task 3: Update `PartyProvider` with join state (AC: #1, #2)
  - [ ] 3.1: Add to `lib/state/party_provider.dart`:
    ```dart
    // New state
    LoadingState _joinPartyLoading = LoadingState.idle;
    List<ParticipantInfo> _participants = [];

    // New getters
    LoadingState get joinPartyLoading => _joinPartyLoading;
    List<ParticipantInfo> get participants => _participants;

    // New mutation methods (called ONLY by SocketClient)
    void onJoinPartyLoading(LoadingState state) {
      _joinPartyLoading = state;
      notifyListeners();
    }

    void onPartyJoined({
      required String sessionId,
      required String partyCode,
      required PartyVibe vibe,
    }) {
      _sessionId = sessionId;
      _partyCode = partyCode;
      _vibe = vibe;
      _isHost = false;
      _joinPartyLoading = LoadingState.success;
      notifyListeners();
    }

    void onParticipantJoined({
      required String userId,
      required String displayName,
      required int participantCount,
    }) {
      _participantCount = participantCount;
      _participants.add(ParticipantInfo(userId: userId, displayName: displayName));
      notifyListeners();
    }

    void onParticipantsSync(List<ParticipantInfo> participants) {
      _participants = participants;
      _participantCount = participants.length;
      notifyListeners();
    }
    ```

  - [ ] 3.2: Create `ParticipantInfo` class (simple data class, NOT in a separate file — keep in party_provider.dart or create `lib/models/participant_info.dart`):
    ```dart
    class ParticipantInfo {
      const ParticipantInfo({required this.userId, required this.displayName});
      final String userId;
      final String displayName;
    }
    ```
    **NOTE on `userId` for guests**: Guests have `user_id = NULL` in the DB. The server returns `p.user_id ?? p.id` (falls back to `session_participants.id` UUID). This ensures every participant has a unique `userId` for widget `ValueKey` diffing.

- [ ] Task 4: Update server `POST /api/auth/guest` response + participant limit (AC: #1)
  - [ ] 4.1: In `apps/server/src/routes/auth.ts`, add `sessionId` to the guest auth response AND enforce 12-participant limit:
    ```typescript
    // BEFORE generating token, check participant count:
    const participants = await getParticipants(session.id);
    if (participants.length >= 12) {
      return reply.status(403).send({
        error: { code: 'SESSION_FULL', message: 'This party is full. Maximum 12 participants.' },
      });
    }

    // Then in the response, add sessionId and vibe:
    return reply.status(200).send({
      data: {
        token,
        guestId,
        sessionId: session.id,  // ADD THIS
        vibe: session.vibe ?? 'general',  // ADD THIS — guest needs vibe for LobbyScreen theming
      },
    });
    ```
  - [ ] 4.2: Update `guestAuthResponseSchema` in `shared/schemas/auth-schemas.ts` to include `sessionId` and `vibe`. **NOTE**: The actual export name is `guestAuthResponseSchema` (NOT `guestAuthResponseDataSchema`) — it wraps the inner schema via `dataResponseSchema()`:
    ```typescript
    export const guestAuthResponseSchema = dataResponseSchema(
      z.object({
        token: z.string(),
        guestId: z.string(),
        sessionId: z.string(),  // ADD THIS
        vibe: z.string(),       // ADD THIS
      })
    );
    ```
  - [ ] 4.3: Update existing tests in `tests/routes/auth.test.ts`:
    - Verify `sessionId` is present in guest auth response
    - Verify `vibe` is present in guest auth response
    - Add test: "returns 403 SESSION_FULL when session has 12 participants"

- [ ] Task 5: Server — Emit `party:joined` on socket connection + add participant to DB (AC: #1, #3)
  - [ ] 5.1: In `apps/server/src/socket-handlers/connection-handler.ts` (or `party-handlers.ts`), after a socket successfully connects and auth middleware has populated `socket.data`:
    ```typescript
    // After socket connects (in connection handler or as first action in party handlers):
    // 1. Add participant to session_participants table
    await addParticipant({
      sessionId: socket.data.sessionId,
      userId: socket.data.role === 'guest' ? undefined : socket.data.userId,
      guestName: socket.data.role === 'guest' ? socket.data.displayName : undefined,
    });

    // 2. Get current participant count
    const participants = await getParticipants(socket.data.sessionId);
    const participantCount = participants.length;

    // 3. Broadcast to ALL other sockets in the room
    socket.to(socket.data.sessionId).emit(EVENTS.PARTY_JOINED, {
      userId: socket.data.userId,
      displayName: socket.data.displayName,
      participantCount,
    });

    // 4. Send full participant list + session metadata to the NEWLY connected socket
    const session = await findById(socket.data.sessionId);
    socket.emit(EVENTS.PARTY_PARTICIPANTS, {
      participants: participants.map(p => ({
        userId: p.user_id ?? p.id,
        displayName: p.guest_name ?? p.display_name,
      })),
      participantCount,
      vibe: session?.vibe ?? 'general',
    });
    ```

  - [ ] 5.2: Add `getParticipants()` to `persistence/session-repository.ts`:
    ```typescript
    export async function getParticipants(sessionId: string) {
      return db
        .selectFrom('session_participants')
        .leftJoin('users', 'users.id', 'session_participants.user_id')
        .select([
          'session_participants.id',
          'session_participants.user_id',
          'session_participants.guest_name',
          'users.display_name',
          'session_participants.joined_at',
        ])
        .where('session_participants.session_id', '=', sessionId)
        .orderBy('session_participants.joined_at', 'asc')
        .execute();
    }
    ```

  - [ ] 5.3: Add `PARTY_PARTICIPANTS` event constant to `shared/events.ts`:
    ```typescript
    PARTY_PARTICIPANTS: 'party:participants',
    ```

  - [ ] 5.4: Handle duplicate participant joins gracefully. The `session_participants` table has a UNIQUE constraint on `(session_id, COALESCE(user_id::text, guest_name))`. Use INSERT...ON CONFLICT DO NOTHING or catch the unique violation and skip. This prevents errors when:
    - Host creates party (already added as participant in `createSession()`) then connects socket
    - Client reconnects after disconnect

  - [ ] 5.5: **CRITICAL**: The host is already added as a participant in `createSession()` (session-manager.ts). The socket connection handler MUST check for existing participant before inserting to avoid duplicate key violation. Use `ON CONFLICT DO NOTHING`:
    ```typescript
    export async function addParticipantIfNotExists(params: {
      sessionId: string;
      userId?: string;
      guestName?: string;
    }) {
      try {
        await addParticipant(params);
      } catch (error: unknown) {
        // Ignore unique constraint violation (participant already exists)
        if (isUniqueViolation(error)) return;
        throw error;
      }
    }
    ```

- [ ] Task 6: Implement JoinScreen join flow (AC: #1, #2, #3)
  - [ ] 6.1: Rewrite `lib/screens/join_screen.dart` to implement the full join flow:
    ```
    +---------------------+
    |  JOIN PARTY          |
    |                      |
    |  [_ _ _ _]           |  ← Party code (pre-filled from deep link)
    |                      |
    |  Enter your name:    |
    |  [____________]      |  ← Display name input
    |                      |
    |  [JOIN]              |  ← DJTapButton, Consequential tier
    |                      |
    |  [Back to home]      |
    +---------------------+
    ```

    **State management:**
    ```dart
    class _JoinScreenState extends State<JoinScreen> {
      late final TextEditingController _codeController;
      late final TextEditingController _nameController;
      String? _errorMessage;

      bool get _canJoin =>
          _codeController.text.length == 4 &&
          _nameController.text.trim().isNotEmpty;
    }
    ```

    **Join handler:**
    ```dart
    Future<void> _onJoin() async {
      setState(() => _errorMessage = null);
      final socketClient = context.read<SocketClient>();
      try {
        await socketClient.joinParty(
          apiClient: context.read<ApiClient>(),
          authProvider: context.read<AuthProvider>(),
          partyProvider: context.read<PartyProvider>(),
          serverUrl: AppConfig.instance.serverUrl,
          displayName: _nameController.text.trim(),
          partyCode: _codeController.text.toUpperCase(),
        );
        if (mounted) context.go('/lobby');
      } catch (e) {
        if (mounted) {
          setState(() => _errorMessage = e.toString());
        }
      }
    }
    ```

    **Visual feedback (AC #1 — 200ms feedback):**
    - Watch `PartyProvider.joinPartyLoading` state
    - On `LoadingState.loading`: show inline loading indicator on button + `Copy.joiningParty` text. UX spec calls for "X friends are waiting for you" social proof — if participant count is available from a preflight check, show `"$count ${Copy.friendsWaiting}"` instead of generic loading text
    - On `LoadingState.error`: show error message below button. Map error codes to user-friendly strings:
      - `NOT_FOUND` → `Copy.partyNotFound`
      - `SESSION_FULL` → `Copy.partyIsFull`
      - Other → `Copy.joinFailed`
    - On `LoadingState.success`: navigate to `/lobby`

  - [ ] 6.2: **Keep existing widget keys** from Story 1.5 stub:
    - `Key('party-code-input')` for code field
    - `Key('join-party-submit-btn')` for join button
    - Add: `Key('display-name-input')` for name field
    - Add: `Key('join-error-message')` for error text

  - [ ] 6.3: Code input behavior:
    - `maxLength: 4`
    - `textCapitalization: TextCapitalization.characters`
    - `inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]'))]`
    - Style: `displayMedium` with center alignment

  - [ ] 6.4: Name input behavior:
    - `maxLength: 30` (matches server Zod schema: `z.string().min(1).max(30)`)
    - `textCapitalization: TextCapitalization.words`
    - Hint: `Copy.enterYourName`
    - No special input formatters

  - [ ] 6.5: If user is already Firebase-authenticated, skip name entry — use `AuthProvider.displayName`. Show the name as read-only text instead of an input field.

- [ ] Task 7: Update LobbyScreen for guest view and real-time participant updates (AC: #1, #2)
  - [ ] 7.1: LobbyScreen must work for BOTH host and guest:
    - **Host view** (existing): QR code + party code + vibe selector + share button + start party button
    - **Guest view** (new): Party code display + vibe display (read-only) + participant list + share button
    - Use `partyProvider.isHost` to conditionally show host-only elements (vibe selector, start party button)
    - Guest should NOT see QR code (they don't need to invite — that's the host's job)

  - [ ] 7.2: Add participant list display:
    ```dart
    // Participant list section
    ...partyProvider.participants.map((p) => Padding(
      padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceXs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: displayVibe.accent.withValues(alpha: 0.3),
            child: Text(
              p.displayName.isNotEmpty ? p.displayName[0].toUpperCase() : '?',
              style: TextStyle(color: displayVibe.accent, fontSize: 14),
            ),
          ),
          const SizedBox(width: DJTokens.spaceSm),
          Text(p.displayName, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    )),
    ```
    Use `ValueKey(p.userId)` on each participant row for correct list diffing.

  - [ ] 7.3: Wire up `party:participants` listener in SocketClient to populate initial participant list when joining:
    ```dart
    on('party:participants', (data) {
      final Map<String, dynamic> payload = data as Map<String, dynamic>;
      final List<dynamic> rawList = payload['participants'] as List<dynamic>;
      final participants = rawList.map((p) => ParticipantInfo(
        userId: (p as Map<String, dynamic>)['userId'] as String,
        displayName: p['displayName'] as String,
      )).toList();
      partyProvider.onParticipantsSync(participants);
    });
    ```

  - [ ] 7.4: Waiting state for <3 players (AC #2):
    - When `participantCount < 3`: show "Waiting for guests..." + share prompt prominently
    - Already partially implemented — `Copy.waitingForGuests` text exists
    - Add additional context: "Works best with 3+ friends!" below participant count when < 3
    - The QR code and share button are already visible for host — ensure they're prominent

- [ ] Task 8: Add copy strings (AC: #1, #2)
  - [ ] 8.1: Add to `lib/constants/copy.dart`:
    ```dart
    // Join flow
    static const String joiningParty = 'Joining party...';
    static const String partyNotFound = 'No active party with that code';
    static const String partyIsFull = 'This party is full. Maximum 12 participants.';
    static const String joinFailed = 'Failed to join party. Please try again.';
    static const String bestWith3Plus = 'Works best with 3+ friends!';
    // Participant list
    static const String participants = 'Participants';
    static const String friendsWaiting = 'friends are waiting for you';
    ```
  - [ ] 8.2: Remove `joinFlowComingSoon` string (no longer needed — was placeholder from Story 1.5)

- [ ] Task 9: Server tests (AC: #1)
  - [ ] 9.1: Update `tests/routes/auth.test.ts`:
    - Verify `sessionId` is present in guest auth response
    - Verify `sessionId` matches the session found by party code

  - [ ] 9.2: Create `tests/socket-handlers/party-join.test.ts`:
    - When socket connects, `party:joined` event is broadcast to other sockets in the room
    - `party:joined` payload contains `userId`, `displayName`, `participantCount`
    - Newly connected socket receives `party:participants` with full participant list and `vibe`
    - Duplicate participant connection does not throw (ON CONFLICT DO NOTHING)
    - Participant is added to `session_participants` table after connection
    - Two guests with the same display name in the same session: second join is handled gracefully (no crash — either reject with clear error or allow with unique participant ID)

  - [ ] 9.3: Create `tests/persistence/session-repository.test.ts` (or add to existing):
    - `getParticipants()` returns all participants for a session ordered by `joined_at`
    - `getParticipants()` joins with `users` table to get `display_name`
    - `addParticipantIfNotExists()` does not throw on duplicate

- [ ] Task 10: Flutter tests (AC: #1, #2, #3)
  - [ ] 10.1: Update `test/screens/join_screen_test.dart`:
    - Renders display name input field with Key `display-name-input`
    - Join button disabled when code empty, name empty, or code < 4 chars
    - Join button enabled when code == 4 chars AND name is non-empty
    - Shows loading indicator when `joinPartyLoading == LoadingState.loading`
    - Shows error message when join fails
    - Shows "Party is full" error when session full (SESSION_FULL code)
    - Shows "No active party" error when party not found (NOT_FOUND code)
    - Navigates to `/lobby` on successful join
    - Pre-fills code from `initialCode` parameter
    - Skips name input when user is Firebase-authenticated

  - [ ] 10.2: Update `test/state/party_provider_test.dart`:
    - `onPartyJoined()` sets sessionId, partyCode, vibe, isHost=false
    - `onJoinPartyLoading()` transitions loading states
    - `onParticipantJoined()` increments count and adds to list
    - `onParticipantsSync()` replaces full participant list

  - [ ] 10.3: Create `test/screens/lobby_screen_test.dart`:
    - Host view shows QR code, vibe selector, start party button
    - Guest view hides QR code and vibe selector
    - Participant list displays names with avatars
    - Participant count updates when new participant joins
    - Waiting state shows invite prompt when < 3 participants
    - Uses `ValueKey` for participant list items

  - [ ] 10.4: Create `test/api/api_client_test.dart` (or add to existing):
    - `guestAuth()` sends correct request body
    - `guestAuth()` returns token, guestId, sessionId, vibe on success
    - `guestAuth()` throws on 404 (party not found)
    - `guestAuth()` throws on 403 (party full)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: Guest authentication and party validation happen on the server. Flutter sends party code + display name, server validates and returns token. No client-side party code validation beyond format check.
- **SocketClient is sole orchestrator**: `joinParty()` method coordinates the entire flow (REST call → auth state update → socket connect). Providers are passive state containers.
- **Provider boundaries ENFORCED**: `PartyProvider` is read-only from widgets. Only `SocketClient` calls mutation methods (`onPartyJoined`, `onParticipantJoined`, `onParticipantsSync`).
- **Socket handler boundary**: `party-handlers.ts` calls `persistence/session-repository.ts` functions through the service layer, NEVER imports from `db/` directly.

### Join Flow — End-to-End Sequence

```
JoinScreen: User enters code + name → taps JOIN
  ↓
SocketClient.joinParty()
  ↓
ApiClient.guestAuth() → POST /api/auth/guest { displayName, partyCode }
  ↓
Server: findByPartyCode(partyCode) → validate session exists + not ended
Server: getParticipants(sessionId) → check count < 12 (reject 403 if full)
Server: generateGuestId() → createGuestToken({ guestId, sessionId, role: 'guest' })
  ↓
Response: { data: { token, guestId, sessionId, vibe } }
  ↓
AuthProvider.onGuestAuthenticated(token, guestId, displayName)
PartyProvider.onPartyJoined(sessionId, partyCode, vibe)
  ↓
SocketClient.connect(token, sessionId, displayName)
  ↓
Server: auth-middleware validates guest JWT → socket.data populated
Server: socket.join(sessionId) → joins room
Server: addParticipantIfNotExists(sessionId, guestName) → DB insert
Server: getParticipants(sessionId) → full list
Server: socket.to(sessionId).emit('party:joined', { userId, displayName, count })
Server: socket.emit('party:participants', { participants, count, vibe })
  ↓
SocketClient receives 'party:participants' → partyProvider.onParticipantsSync()
Other clients receive 'party:joined' → partyProvider.onParticipantJoined()
  ↓
context.go('/lobby') → LobbyScreen renders with correct vibe theme + participant list
```

### Server: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| Guest auth endpoint | `routes/auth.ts` | Already handles `POST /api/auth/guest`. Just add `sessionId` to response |
| Guest token creation | `services/guest-token.ts` | `createGuestToken({ guestId, sessionId, role })` — already works |
| Session lookup by code | `persistence/session-repository.ts` | `findByPartyCode()` — already filters `status != 'ended'` |
| Add participant | `persistence/session-repository.ts` | `addParticipant()` — already exists, need to handle duplicates |
| Auth middleware | `socket-handlers/auth-middleware.ts` | Already validates both Firebase + guest tokens, joins room |
| Event constants | `shared/events.ts` | `PARTY_JOINED` already defined, add `PARTY_PARTICIPANTS` (new event — not in original architecture catalog, added for bulk participant sync on join) |
| Socket data shape | `shared/socket-types.ts` | `SocketData { userId, sessionId, role, displayName }` |

### Server: What to Add (minimal changes)

1. **`routes/auth.ts`**: Add `sessionId`, `vibe` to guest auth response + 12-participant limit check (~10 lines)
2. **`shared/schemas/auth-schemas.ts`**: Add `sessionId: z.string()`, `vibe: z.string()` to response schema (2 lines)
3. **`persistence/session-repository.ts`**: Add `getParticipants(sessionId)` function + `addParticipantIfNotExists()` wrapper
4. **`socket-handlers/connection-handler.ts` or `party-handlers.ts`**: On socket connect → addParticipant, broadcast `party:joined`, send `party:participants` with vibe
5. **`shared/events.ts`**: Add `PARTY_PARTICIPANTS` constant (new event, not in original architecture catalog)

### Flutter: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| JoinScreen stub | `screens/join_screen.dart` | Has code input, router integration. Enhance, don't replace |
| SocketClient.createParty() | `socket/client.dart` | Follow exact same pattern for `joinParty()` |
| ApiClient.createSession() | `api/api_client.dart` | Follow exact same HTTP pattern for `guestAuth()` |
| PartyProvider | `state/party_provider.dart` | Add methods, don't restructure existing state |
| LobbyScreen | `screens/lobby_screen.dart` | Add participant list + guest view, don't rewrite |
| Copy strings | `constants/copy.dart` | Add new strings, keep existing |
| GoRouter /join route | `app.dart` | Already configured with deep link support |

### Critical Patterns (MUST follow)

**REST error response format:**
```typescript
{ error: { code: 'NOT_FOUND', message: 'No active party with that code' } }
```

**Socket.io event payload format (NOT wrapped):**
```typescript
socket.emit('party:joined', { userId, displayName, participantCount });
// NOT: socket.emit('party:joined', { data: { ... } });
```

**Import rules — server:**
```typescript
import { addParticipant } from '../persistence/session-repository.js'; // relative + .js
```

**Import rules — Flutter:**
```dart
import 'package:karamania/state/party_provider.dart'; // package import
```

**Naming:**
- Server files: `kebab-case.ts`
- Flutter files: `snake_case.dart`
- Socket events: `namespace:action` (e.g., `party:joined`, `party:participants`)
- Widget keys: `Key('kebab-case-descriptor')`
- Zod schemas: `camelCaseSuffixSchema` (e.g., `guestAuthResponseSchema`). Response schemas use `dataResponseSchema()` wrapper

**DB casing:**
- All columns `snake_case` in persistence layer
- Conversion to `camelCase` happens ONCE at boundary: event emission for Socket.io

**LoadingState pattern:**
```dart
enum LoadingState { idle, loading, success, error }
// Per-operation: joinPartyLoading, NOT isLoading
```

### 12-Participant Limit (Architecture Mandate)

Architecture specifies max 12 participants per session (NFR5: "60fps with 12 participants"). The limit is enforced at the REST layer (`POST /api/auth/guest`) BEFORE generating a token. If `getParticipants(sessionId).length >= 12`, return `403 SESSION_FULL`. This prevents the guest from ever getting a token or connecting a socket to a full party.

Error response: `{ error: { code: 'SESSION_FULL', message: 'This party is full. Maximum 12 participants.' } }`

### Duplicate Participant Handling

The `session_participants` table has a UNIQUE constraint: `UNIQUE(session_id, COALESCE(user_id::text, guest_name))`. This means:
- Same user can't join the same session twice
- **Same guest name in the same session would conflict** — if two guests named "Alice" try to join, the second insert hits the unique constraint
- Host is already added as participant in `createSession()`
- Socket reconnection would try to add participant again

**Solution for reconnection/host**: Use try/catch around `addParticipant()` and silently ignore unique constraint violations. Or use INSERT...ON CONFLICT DO NOTHING. The participant already exists — just proceed with the broadcast.

**Solution for duplicate guest names**: The UNIQUE constraint on `COALESCE(user_id::text, guest_name)` means guest names must be unique per session. The `addParticipantIfNotExists` function silently ignores the conflict. Since the guest already has a valid auth token from the REST endpoint, and the socket connection succeeds (auth middleware doesn't check participant table), the duplicate-name guest will still appear in the party. The participant record just won't be duplicated. This is acceptable for MVP — duplicate name handling (auto-suffix "Alice (2)") can be added post-MVP if needed.

### Mid-Session Join Scope

`findByPartyCode()` filters `status != 'ended'`, which allows joins during `lobby`, `active`, AND `paused` states. This is correct — Story 1.7 (Party Start & Mid-Session Join) adds the catch-up UI for late joiners, but the ability to JOIN during an active session is enabled by this story. No additional status check needed here.

### LobbyScreen State Model

The UX spec defines three LobbyScreen states: `pre-join`, `joined`, `host-ready`. These are NOT formal enums — they map to conditional rendering based on provider properties:
- **`pre-join`**: Handled by JoinScreen (separate route `/join`), not LobbyScreen
- **`joined`**: Default LobbyScreen state — guest or host with `participantCount < 3`
- **`host-ready`**: Host with `participantCount >= 3` — "START PARTY" button becomes active (Story 1.7 scope, DO NOT implement here)

### Cross-Story Dependencies

- **Story 1.4 (Party Creation)**: QR code URL format is `${webLandingUrl}?code=$partyCode`. JoinScreen receives code from deep link or manual entry. Session status is 'lobby' after creation.
- **Story 1.5 (Web Landing)**: Deep link routes `/?code=VIBE` → `/join?code=VIBE` → JoinScreen with `initialCode`. This is already working.
- **Story 1.7 (Party Start)**: Will enable the "START PARTY" button when `participantCount >= 3`. This story sets up the participant counting infrastructure that Story 1.7 depends on. DO NOT enable start party in this story.
- **Story 1.8 (Connection Resilience)**: Will handle reconnection, buffered events, and state recovery. This story only needs basic connection — reconnection robustness is Story 1.8's scope.

### Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| `socket.emit('partyJoined', ...)` | `socket.emit('party:joined', ...)` |
| Client-side party code validation via API | Format check only (4 chars, alphanumeric); server validates existence |
| `setState(() { participants.add(...) })` in widget | `partyProvider.onParticipantJoined(...)` called by SocketClient |
| Direct socket listener in LobbyScreen widget | SocketClient handles all socket events, updates provider |
| `import { getParticipants } from '@/persistence/...'` | `import { getParticipants } from '../persistence/session-repository.js'` |
| Barrel file for participant types | Import directly from specific file |
| `Color(0xFF6C63FF)` for avatar background | `displayVibe.accent.withValues(alpha: 0.3)` |
| Hardcoded "Joining..." in widget | `Copy.joiningParty` from constants |
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| `Navigator.push()` for navigation | `context.go('/lobby')` via GoRouter |
| Create new `participant_dot.dart` widget | Inline participant row in LobbyScreen (widget extraction is Story 2+ when needed in multiple screens) |
| Allow unlimited participants to join | Enforce 12-participant limit at REST auth endpoint (`403 SESSION_FULL`) |
| Omit vibe from join response/events | Always include vibe so guest LobbyScreen renders with correct theme |

### Previous Story Intelligence

**From Story 1.5 (most recent):**
- JoinScreen stub exists at `lib/screens/join_screen.dart` with code input field, join button, back button
- Widget keys: `party-code-input`, `join-party-submit-btn` — KEEP these keys
- GoRouter redirect `/?code=X` → `/join?code=X` is working
- Home screen "JOIN PARTY" button navigates to `/join`
- `@fastify/static` registered AFTER API routes — keep this order
- 6 server tests + 8 Flutter join screen tests + 4 deep link tests exist — update, don't break

**From Story 1.4 (Party Creation):**
- `SocketClient.createParty()` is the exact pattern to follow for `joinParty()`
- `ApiClient.createSession()` is the pattern for `guestAuth()`
- `PartyProvider.onPartyCreated()` sets sessionId, partyCode, isHost=true, participantCount=1
- Host is added as participant in `createSession()` via `session-manager.ts` → `addParticipant()`
- `LobbyScreen` shows participant count via `partyProvider.participantCount`
- QR code uses `AppConfig.instance.webLandingUrl` — works correctly
- Debug lesson: `QrEyeShape.roundedRect` not available — only `square`/`circle`

**From Story 1.3 (Auth + WebSocket):**
- `POST /api/auth/guest` already exists in `routes/auth.ts`
- Guest token: `{ sub: guestId, sessionId, role: 'guest', iat, exp }` via `jose` library
- Auth middleware validates both Firebase (RS256 with kid header) and guest (HS256 without kid) tokens
- After auth: `socket.data = { userId, sessionId, role, displayName }`
- Socket auto-joins room: `socket.join(socket.data.sessionId)` — room isolation per NFR24
- `routes/auth.ts` test pattern: needs `validatorCompiler`/`serializerCompiler` from `fastify-type-provider-zod`

**From Story 1.2 (Server Foundation):**
- Error helpers: `notFoundError()`, `badRequestError()` from `shared/errors.ts`
- REST response format: `{ data: {...} }` or `{ error: { code, message } }`
- All server tests use `Vitest` + Fastify `.inject()` for HTTP tests

**From Story 1.1 (Flutter Scaffold):**
- DJTokens spacing: spaceXs=4, spaceSm=8, spaceMd=16, spaceLg=24, spaceXl=32
- DJTapButton with TapTier enum: consequential (64x64, long-press), social (56x56, immediate), private (48x48, immediate)
- GoRouter in `app.dart` — add routes there, not in separate router file
- All providers in `bootstrap.dart` MultiProvider
- ConstrainedBox maxWidth 428 pattern on all screens

### Project Structure Notes

```
apps/server/
  src/
    routes/
      auth.ts                           # MODIFIED: add sessionId to guest auth response
    persistence/
      session-repository.ts             # MODIFIED: add getParticipants(), addParticipantIfNotExists()
    socket-handlers/
      connection-handler.ts             # MODIFIED: add participant on connect, broadcast party:joined
    shared/
      events.ts                         # MODIFIED: add PARTY_PARTICIPANTS constant
      schemas/
        auth-schemas.ts                 # MODIFIED: add sessionId to response schema
  tests/
    routes/
      auth.test.ts                      # MODIFIED: verify sessionId in response
    socket-handlers/
      party-join.test.ts                # NEW: party join socket event tests

apps/flutter_app/
  lib/
    screens/
      join_screen.dart                  # MODIFIED: full join flow with name entry
      lobby_screen.dart                 # MODIFIED: guest view + participant list
    state/
      party_provider.dart               # MODIFIED: add join state + participant tracking
    socket/
      client.dart                       # MODIFIED: add joinParty() + party event listeners
    api/
      api_client.dart                   # MODIFIED: add guestAuth() method
    constants/
      copy.dart                         # MODIFIED: add join flow strings
    models/
      participant_info.dart             # NEW (optional — can be in party_provider.dart)
  test/
    screens/
      join_screen_test.dart             # MODIFIED: test actual join flow
      lobby_screen_test.dart            # NEW: lobby screen tests
    state/
      party_provider_test.dart          # MODIFIED: test new join methods
    api/
      api_client_test.dart              # NEW (optional): API client tests
```

### Testing Requirements

- **DO test**: Join flow (API call, socket connect, state updates), participant list rendering, loading states, error states, guest auth response shape, socket event broadcasting, participant DB persistence, lobby host/guest view differences
- **DO NOT test**: Actual WebSocket connection in Flutter unit tests (mock SocketClient), animations, visual effects, exact colors
- **Server**: Vitest with Fastify `.inject()` for HTTP, socket.io-client for socket tests
- **Flutter**: flutter_test with mocked providers and SocketClient
- **Verify NO regressions**: 86+ server tests, 97+ Flutter tests must continue to pass

### Performance Budget

- Join flow: 200ms visual feedback (AC #1) — show loading state immediately, don't wait for API response
- WebSocket handshake: <500ms (NFR34) — Socket.io with auth in handshake
- Lobby participant update: Real-time via socket broadcast — no polling

### References

- [Source: epics.md#Story 1.6] — FR4, FR8, FR53, NFR15, NFR16, NFR22
- [Source: architecture.md#WebSocket Authentication Flow] — Unified auth middleware, guest token strategy, session:full error path (12 max)
- [Source: architecture.md#Component Boundaries] — socket-handlers call services, not persistence directly
- [Source: architecture.md#Socket.io Event Convention] — party:joined, party:created bidirectional events
- [Source: architecture.md#Provider Update Pattern] — SocketClient sole mutation source
- [Source: ux-design-specification.md#Join Flow] — Path A (app installed) + Path B (first-time), "3 friends waiting" loading state
- [Source: ux-design-specification.md#LobbyScreen] — States: pre-join, joined, host-ready
- [Source: project-context.md#Socket.io Event Catalog] — party namespace events
- [Source: project-context.md#Flutter Boundaries] — providers read-only, SocketClient mutates
- [Source: project-context.md#Error Handling] — REST wrapped, Socket.io direct objects
- [Source: 1-5-web-landing-page-and-deep-linking.md] — Deep link routing, JoinScreen stub, widget keys
- [Source: 1-4-party-creation-and-qr-code-generation.md] — createParty pattern, QR code URL format

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
