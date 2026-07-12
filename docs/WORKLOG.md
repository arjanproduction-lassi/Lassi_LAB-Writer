# Worklog

## 2026-07-12

- Added Tichý Svitok v2 as a small Google Drive sync comfort pass.
- Added quiet sync attempts on app open and when returning to the foreground,
  but only when Svitok is enabled and an access token is already active in
  memory.
- Added a debounced quiet sync after save, delete, or changed manual import.
- Added online/offline awareness so Writer does not call Google while offline
  and keeps local writing uninterrupted.
- Added calmer sync status copy: waiting for Google, offline, syncing, pending
  local changes, and "Písať môžeš ďalej, Writer ukladá lokálne."
- Kept Google popup behavior user-initiated only.
- Kept tokens in memory only and did not add refresh tokens, backend, custom
  accounts, AI, media capture, Songbook integration, Storyboard integration, or
  shared databases.

## 2026-07-10

- Added the first Keep-like Svitok comfort pass for Google Drive sync.
- Added non-secret local sync preferences:
  `googleSyncEnabled`, `lastSyncAt`, `lastSyncResult`, `lastSyncError`, and
  `pendingLocalChanges`.
- Successful Google connect now enables Svitok locally.
- Saving, deleting, or importing changed sparks marks local changes as pending.
- If a Google access token is already active in memory, Writer tries a quiet
  sync after local changes without forcing a new consent prompt.
- If no in-memory token exists, Writer keeps data local and shows a calm waiting
  state instead of opening an aggressive popup.
- Kept manual JSON export/import and manual **Synchronizovať teraz** as safety
  fallbacks.
- Kept tokens in memory only and did not add a backend, custom accounts, AI,
  media capture, Songbook integration, Storyboard integration, or shared
  databases.

## 2026-07-09

- Added sync-safe spark delete as a soft delete.
- Added optional `deletedAt` to sparks.
- Delete sets both `deletedAt` and `updatedAt` to the current timestamp.
- Normal Writer lists hide deleted sparks.
- Manual JSON export/import and Google Drive sync keep deleted tombstones in the
  DB payload so deletes can travel across devices.
- Kept the main capture flow unchanged and did not add restore, permanent purge,
  backend, AI, media capture, Songbook integration, or Storyboard integration.

## 2026-07-05

- Added experimental manual Google Drive sync as the next device bridge for one
  author across PC, mobile, and tablet.
- Added browser-only Google Identity Services token flow behind
  `VITE_GOOGLE_CLIENT_ID`.
- Added Drive API calls for one hidden `appDataFolder` DB file:
  `lassilab-writer-db-v001.json`.
- Reused the Writer DB merge rule for manual import and Google sync: merge by
  spark `id`, keep the newer `updatedAt`, and avoid duplicates.
- Added a local backup before sync merges under
  `lassilab-writer:v0.1:sparks:backup-before-sync`.
- Kept tokens in memory only and did not add a backend, custom accounts,
  automatic background sync, AI, media capture, Songbook integration,
  Storyboard integration, or shared databases.
- Added manual Writer DB export/import as the first device bridge.
- Added `Exportovať DB` and `Importovať DB` actions in a small data section.
- Export creates `LassiLAB_Writer_DBv001_YYYY-MM-DD.json`.
- Import validates the Writer DB structure, backs up current local sparks before
  writing, merges by spark `id`, and keeps the newer `updatedAt` version.
- Kept persistence local to `localStorage`.
- Kept cloud sync, accounts, backend, AI, media capture, Songbook integration,
  Storyboard integration, and shared databases out of scope.

## 2026-07-03

- Added the first minimal Vite, React, and TypeScript shell.
- Added a mobile-first dark workshop interface.
- Added the local text spark loop:
  - create a new spark
  - save it locally
  - show recent sparks
  - reopen a spark
  - edit and save again
- Added `src/types.ts` for the v0.1 `Spark` model.
- Added `src/storage.ts` as a small `localStorage` adapter.
- Added a basic web app manifest.
- Kept AI, voice, melody, image upload, integrations, accounts, sync,
  collaboration, and export bridges out of scope.
