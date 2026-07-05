# Implementation Plan

## Current Slice

Build only the true v0.1 loop:

1. Open Writer.
2. Tap "⚡ Nová iskra".
3. Enter one short text spark.
4. Save it locally.
5. See it in recent sparks.
6. Reopen a saved spark.
7. Edit and save it again.
8. Export the local Writer DB as a JSON file.
9. Import a Writer DB JSON file on another device.
10. Optionally connect Google Drive for an experimental manual sync.
11. Tap "Synchronizovat teraz" to merge PC, mobile, and tablet sparks.

The JSON export/import is only a manual device bridge. It does not introduce
cloud sync, accounts, backends, or shared databases.

The Google Drive bridge is the next experimental manual bridge. It uses the
user's Google account only for authorization and stores one hidden DB file in
Google Drive `appDataFolder`. It is not automatic background sync and it does
not create a backend or a shared collaborative database.

## Technical Shape

- Vite, React, and TypeScript.
- No backend.
- No routing.
- No extra UI framework.
- `localStorage` only for v0.1 persistence.
- Manual JSON export/import copies the local Writer DB between devices.
- Experimental Google Drive sync uses browser-only Google Identity Services,
  the `drive.appdata` scope, and direct Drive API calls.
- Google Drive sync reads `VITE_GOOGLE_CLIENT_ID`; when it is missing, the app
  still builds and shows sync as unavailable.
- Storage access isolated behind `src/storage.ts` so IndexedDB can replace it
  later without rewriting the app surface.

## Data Shape

The v0.1 `Spark` model contains:

- `id`
- `title`
- `text`
- `createdAt`
- `updatedAt`
- `temperature`
- `tags`
- `schemaVersion`

`temperature` defaults to `"spark"`. `tags` defaults to an empty array.

The manual DB export uses:

- `app`
- `schemaVersion`
- `exportedAt`
- `sparkCount`
- `sparks`

The import path merges sparks by `id`. Existing sparks are updated only when the
imported `updatedAt` value is newer.

The Google Drive sync stores the same Writer DB shape in:

- `lassilab-writer-db-v001.json`
- Google Drive `appDataFolder`

Sync also merges by `id`, keeps the newer `updatedAt`, avoids duplicates, and
backs up local sparks before applying a remote merge.

## Explicit Non-Goals

- No AI or Kováč implementation.
- No voice recording.
- No melody recording.
- No image upload.
- No Songbook or Storyboard integration.
- No custom accounts.
- No automatic background cloud sync.
- No collaboration.
- No Songbook or Storyboard export bridges.
- No shared import/export contract beyond the manual Writer DB JSON file.
