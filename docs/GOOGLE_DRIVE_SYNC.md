# Google Drive Sync

## Status

Experimental v0.2 bridge for one LassiLAB Writer author across PC, mobile, and
tablet.

Google Drive sync is working across PC and mobile when the Google Cloud OAuth
client and Vercel `VITE_GOOGLE_CLIENT_ID` are configured.

This is not full automatic background sync. The user still has the manual
**Synchronizovať teraz** fallback, but Writer now has the first Keep-like comfort
pass: after Google is connected, local saves/deletes can trigger a quiet sync
when an access token is already active in memory.

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
6. Save/delete marks `pendingLocalChanges`.
7. If the in-memory token is still active, Writer tries a quiet sync.
8. If no active token exists, Writer does not force a popup; it shows that
   changes are waiting for Google connection or manual sync.
9. During sync, Writer lists `appDataFolder` for `lassilab-writer-db-v001.json`.
10. If the file does not exist, Writer creates it from the local DB.
11. If the file exists, Writer downloads it.
12. Writer validates the remote DB structure.
13. Writer backs up local sparks before applying a merge.
14. Writer merges by spark `id`; newer `updatedAt` wins.
15. Writer saves merged sparks locally.
16. Writer uploads the merged DB back to the same Drive file.

Deleted sparks are included as tombstones with `deletedAt`. They stay hidden
from normal Writer lists, but remain in the sync payload so deletes can travel
between devices.

## Safety Rules

- If authorization fails, local data is untouched.
- If the remote file is invalid, local data is untouched.
- If upload fails after local merge, Writer shows a warning and the user can
  tap sync again.
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
3. Tap **Synchronizovať teraz** on PC, or save again while the token is still
   active and confirm quiet sync runs.
4. Open Writer on mobile.
5. Connect Google with the same Google account.
6. Tap **Synchronizovať teraz** on mobile.
7. Confirm the PC spark appears on mobile.

Mobile to PC:

1. Save a spark on mobile.
2. If Google is already connected in the current session, confirm Writer tries a
   quiet sync after save. Otherwise tap **Synchronizovať teraz**.
3. Tap **Synchronizovať teraz** on PC.
4. Confirm the mobile spark appears on PC.

Conflict:

1. Edit the same spark on two devices.
2. Sync the older edit first.
3. Sync the newer edit after that.
4. Confirm the newer `updatedAt` version wins.

## Known Limitations

- Initial connection and expired-token recovery still require user action.
- There is no automatic pull on app open yet.
- There is no timer-based background sync.
- There is no real-time conflict UI.
- Delete sync uses `deletedAt` tombstones; there is no restore or permanent
  purge UI yet.
- Access tokens are short-lived and may require reconnecting.
- Google OAuth setup and Vercel `VITE_GOOGLE_CLIENT_ID` must be completed before
  production sync works.
