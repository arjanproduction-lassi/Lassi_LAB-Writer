# Google Drive Sync

## Status

Experimental v0.2 bridge for one LassiLAB Writer author across PC, mobile, and
tablet.

Google Drive sync is working across PC and mobile when the Google Cloud OAuth
client and Vercel `VITE_GOOGLE_CLIENT_ID` are configured.

This is not full automatic background sync. The user still has the manual
**Synchronizovať teraz** fallback, but Writer now has a second Keep-like comfort
pass: after Google is connected, Writer can try quiet sync on app open, on
return to the app, and shortly after saved local changes when an access token is
already active in memory.

## What It Is

- Google account is used only for authorization.
- Google Drive stores one hidden Writer DB file in `appDataFolder`.
- The remote file name is `lassilab-writer-db-v001.json`.
- The local browser still uses `localStorage` as its local cache.
- A small local sync preference record remembers whether Svitok is enabled,
  last sync status, and whether local changes are waiting.
- Manual JSON export/import remains available.

## What It Is Not

- Not Gmail email transport.
- Not a backend.
- Not custom accounts.
- Not collaboration.
- Not a shared database.
- Not full automatic background sync.
- Not Songbook or Storyboard integration.

## Google Scope

Writer requests only:

```text
https://www.googleapis.com/auth/drive.appdata
```

Google documents this as the scope for viewing and managing an app's own
configuration data in Google Drive. The `appDataFolder` is hidden from the user
and from other Drive apps, and is intended for app-specific data.

Useful official docs:

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update

## Runtime Model

1. User taps **Pripojiť Google** or **Synchronizovať teraz**.
2. Browser loads Google Identity Services.
3. Google returns a short-lived access token.
4. Writer keeps the access token in memory only.
5. A successful Google connection enables Svitok in local sync preferences.
6. Save/delete/import marks `pendingLocalChanges`.
7. After saved local changes, Writer waits briefly, then tries a quiet sync if
   the in-memory token is still active.
8. On app open, Writer tries a quiet sync only when Svitok is enabled and the
   token is already active in memory.
9. When the page returns to foreground, Writer tries a quiet sync if there are
   pending changes or the last sync is stale.
10. If the browser is offline, Writer does not call Google and shows that
    changes are saved locally.
11. If no active token exists, Writer does not force a popup; it shows that
    Svitok is waiting for Google connection or manual sync.
12. During sync, Writer lists `appDataFolder` for `lassilab-writer-db-v001.json`.
13. If the file does not exist, Writer creates it from the local DB.
14. If the file exists, Writer downloads it.
15. Writer validates the remote DB structure.
16. Writer backs up local sparks before applying a merge.
17. Writer merges by spark `id`; newer `updatedAt` wins.
18. Writer saves merged sparks locally.
19. Writer uploads the merged DB back to the same Drive file.

Deleted sparks are included as tombstones with `deletedAt`. They stay hidden
from normal Writer lists, but remain in the sync payload so deletes can travel
between devices.

## Future Writer DB v2 Rollout

Current production sync uses:

```text
lassilab-writer-db-v001.json
```

Future WriterPackage sync should use a separate v2 file, for example:

```text
lassilab-writer-db-v002.json
```

This rollout is intentionally cautious because one author may use PC, notebook,
tablet, and mobile, and not all devices refresh at exactly the same time.

### v2 Payload Goal

The v2 payload should carry both models:

```ts
type WriterDbV2 = {
  app: "LassiLAB Writer";
  schemaVersion: 2;
  exportedAt: string;
  sparkCount: number;
  packageCount: number;
  sparks: Spark[];
  packages: WriterPackage[];
};
```

`sparkCount` and `packageCount` are informational only. The `sparks` and
`packages` arrays are the source of truth.

### Rollout Phases

Phase A: dual-read, v1-write

- New clients can parse local/manual v1 and proposed v2 payloads.
- Google sync still writes only `lassilab-writer-db-v001.json`.
- No production UI creates WriterPackage records yet.
- This proves v2 parsing and validation without risking remote sync data.

Phase B: v2 manual export/import

- Manual export can produce `LassiLAB_Writer_DBv002_YYYY-MM-DD.json`.
- Manual import accepts both v1 and v2.
- v1 import merges Sparks only and must not touch Packages.
- v2 import merges Sparks and Packages.
- No Google v2 writing yet.

Phase C: v2 remote shadow/readiness

- New clients may create or read `lassilab-writer-db-v002.json`.
- v1 sync remains the production source for Sparks.
- Writer warns or blocks package sync until all active devices are refreshed to
  a client that understands v2.
- This avoids a stale v1-only client overwriting or ignoring v2 package data.

Phase D: v2 primary sync

- After the author confirms all active devices have the new client, v2 becomes
  the primary remote file.
- Sync reads/writes `lassilab-writer-db-v002.json`.
- v1 remains read-only fallback or backup.
- v1 should not be updated from v2 automatically unless a separate compatibility
  export is deliberately designed.

### Split-Brain Avoidance

Do not run v1 and v2 as equal write targets indefinitely. That would create two
remote truths. During transition, there should be a clear primary write target:

- early rollout: v1 is primary, v2 is read/manual/shadow
- later rollout: v2 is primary, v1 is fallback/backup

### v2 Sync Safety Rules

- Invalid remote v2 payload must leave local data untouched.
- A v2 sync backup must include both local Sparks and local WriterPackages.
- Missing records in the remote payload do not imply local deletion.
- `deletedAt` tombstones travel in both `sparks` and `packages`.
- Newer `updatedAt` wins for records with the same id.
- Same id may exist as Spark and Package during transition; sync must not delete
  the Spark automatically.
- The shared catalog can prefer Package for display, but storage stays separate.

## Safety Rules

- If authorization fails, local data is untouched.
- If the remote file is invalid, local data is untouched.
- If upload fails after local merge, Writer shows a warning and the user can
  tap sync again.
- Writer never opens a Google popup without a user action.
- Quiet sync uses only an access token already active in memory.
- Before every sync merge, Writer writes:

```text
lassilab-writer:v0.1:sparks:backup-before-sync
```

## Local Sync Preferences

Writer stores non-secret sync preferences in `localStorage` under:

```text
lassilab-writer:v0.1:google-sync-preferences
```

Allowed fields:

- `googleSyncEnabled`
- `lastSyncAt`
- `lastSyncResult`
- `lastSyncError`
- `pendingLocalChanges`

This record must never contain an access token, refresh token, client secret, or
Google OAuth client ID. The access token stays in memory only.

## Setup

Google Cloud:

1. Create or open a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen.
4. Add scope:
   `https://www.googleapis.com/auth/drive.appdata`.
5. Create OAuth Client ID, type **Web application**.
6. Add authorized JavaScript origins:
   - `https://lassi-lab-writer.vercel.app`
   - `http://localhost:5173` for local dev, if needed

Vercel:

1. Open the `lassi-lab-writer` project.
2. Add environment variable:
   `VITE_GOOGLE_CLIENT_ID=<google-client-id>`
3. Apply it to Production and Preview.
4. Redeploy.

If `VITE_GOOGLE_CLIENT_ID` is missing, the app still builds and runs. Google
sync appears as unavailable.

## Test Matrix

PC to mobile:

1. Save a spark on PC.
2. Connect Google on PC.
3. Tap **Synchronizovať teraz** once, or save again while the token is still
   active and confirm Writer waits briefly before quiet sync.
4. Open Writer on mobile.
5. Connect Google with the same Google account.
6. Tap **Synchronizovať teraz** on mobile.
7. Confirm the PC spark appears on mobile.

Mobile to PC:

1. Save a spark on mobile.
2. If Google is already connected in the current session, confirm Writer tries a
   debounced quiet sync after save. Otherwise tap **Synchronizovať teraz**.
3. Tap **Synchronizovať teraz** on PC.
4. Confirm the mobile spark appears on PC.

Open/return behavior:

1. Connect Google and sync once.
2. Save or edit a spark while the access token is still active.
3. Switch to another app or tab, then return.
4. Confirm Writer tries quiet sync if there are pending changes or the last sync
   is stale.
5. Close and reopen the browser. If the in-memory token is gone, confirm Writer
   does not open Google automatically and shows a waiting state.

Offline:

1. Turn the device offline.
2. Save a spark.
3. Confirm Writer keeps it locally and shows an offline state.
4. Return online.
5. If the token is still active, Writer may sync quietly; if not, it waits for a
   user Google action.

Conflict:

1. Edit the same spark on two devices.
2. Sync the older edit first.
3. Sync the newer edit after that.
4. Confirm the newer `updatedAt` version wins.

## Known Limitations

- Initial connection and expired-token recovery still require user action.
- App-open and foreground sync only work when an access token is already active
  in memory.
- There is no timer-based background sync.
- There is no real-time conflict UI.
- Delete sync uses `deletedAt` tombstones; there is no restore or permanent
  purge UI yet.
- Access tokens are short-lived and may require reconnecting.
- Google OAuth setup and Vercel `VITE_GOOGLE_CLIENT_ID` must be completed before
  production sync works.
