# Google Drive Sync

## Status

Experimental v0.2 bridge for one LassiLAB Writer author across PC, mobile, and
tablet.

This is not full automatic sync. The user must tap **Synchronizovať teraz**.

## What It Is

- Google account is used only for authorization.
- Google Drive stores one hidden Writer DB file in `appDataFolder`.
- The remote file name is `lassilab-writer-db-v001.json`.
- The local browser still uses `localStorage` as its local cache.
- Manual JSON export/import remains available.

## What It Is Not

- Not Gmail email transport.
- Not a backend.
- Not custom accounts.
- Not collaboration.
- Not a shared database.
- Not automatic background sync.
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
5. Writer lists `appDataFolder` for `lassilab-writer-db-v001.json`.
6. If the file does not exist, Writer creates it from the local DB.
7. If the file exists, Writer downloads it.
8. Writer validates the remote DB structure.
9. Writer backs up local sparks before applying a merge.
10. Writer merges by spark `id`; newer `updatedAt` wins.
11. Writer saves merged sparks locally.
12. Writer uploads the merged DB back to the same Drive file.

## Safety Rules

- If authorization fails, local data is untouched.
- If the remote file is invalid, local data is untouched.
- If upload fails after local merge, Writer shows a warning and the user can
  tap sync again.
- Before every sync merge, Writer writes:

```text
lassilab-writer:v0.1:sparks:backup-before-sync
```

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
3. Tap **Synchronizovať teraz** on PC.
4. Open Writer on mobile.
5. Connect Google with the same Google account.
6. Tap **Synchronizovať teraz** on mobile.
7. Confirm the PC spark appears on mobile.

Mobile to PC:

1. Save a spark on mobile.
2. Tap **Synchronizovať teraz** on mobile.
3. Tap **Synchronizovať teraz** on PC.
4. Confirm the mobile spark appears on PC.

Conflict:

1. Edit the same spark on two devices.
2. Sync the older edit first.
3. Sync the newer edit after that.
4. Confirm the newer `updatedAt` version wins.

## Known Limitations

- Sync is manual.
- There is no real-time conflict UI.
- There is no delete sync yet.
- Access tokens are short-lived and may require reconnecting.
- Google OAuth setup must be completed before Vercel production sync works.
