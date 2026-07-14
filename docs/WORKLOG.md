# Worklog

## 2026-07-14 - Read-only Writer DB parser foundation

- Added a read-only `WriterDbV1 | WriterDbV2` parser foundation in
  `src/writerDb.ts`.
- The parser validates the app marker, `schemaVersion`, `exportedAt`, counts,
  Sparks, and v2 Writer Packages.
- Counts remain informational only; the arrays are the source of truth.
- Invalid JSON, unsupported versions, or invalid records return `ok: false`
  instead of throwing an unhandled error.
- The parser does not write to localStorage, does not migrate data, does not
  create v2 payloads, and does not change production export/import or Google
  Drive sync.
- The next smallest step is manual v2 export, not Google sync.

## 2026-07-13 - Writer DB v2 design

- Documented a proposed Writer DB v2 envelope that can carry both legacy
  `Spark` records and new `WriterPackage` records.
- Clarified that `sparkCount` and `packageCount` are informational only; the
  arrays are the source of truth.
- Documented v1/v2 import compatibility rules: v1 imports merge Sparks only,
  v2 imports merge Sparks and Packages, missing records do not imply deletion,
  tombstones remain valid, and newer `updatedAt` wins.
- Documented temporary Spark/Package id conflicts: both can coexist, the
  read-only catalog prefers WriterPackage, and final migration is a separate
  explicit step.
- Recommended whole-package merge by package `id` and top-level `updatedAt` as
  the smallest safe first merge model.
- Added a phased Google Drive rollout plan from v1-only sync to v2 primary sync
  without creating two equal write targets.
- No runtime code changes, no export/import behavior change, no Google sync
  payload change, and no automatic migration.

## 2026-07-13 - Writer Package storage foundation

- Added separate Writer Package local storage foundation under
  `lassilab-writer:v0.1:packages`.
- Kept legacy Sparks in the existing `lassilab-writer:v0.1:sparks` storage.
- Added package storage helpers for loading, saving, upserting, and finding
  Writer Packages.
- Added a read-only package catalog that combines real Writer Packages with
  legacy Sparks adapted through `adaptSparkToWriterPackage`.
- The catalog prefers a real Writer Package when the same id also exists as a
  legacy Spark.
- The catalog sorts by `updatedAt`, newest first.
- No UI behavior change, no automatic migration, no Spark storage change, no
  Writer DB export/import change, and no Google Drive sync payload change.

## 2026-07-13 - Writer Package legacy adapter

- Added the first runtime-safe Writer Package data bridge.
- Added `WriterPackage` and `WriterPackageNote` types.
- Kept `Spark` as the active legacy storage model.
- Added a deterministic read-only adapter from old `Spark` records to
  `WriterPackage` views.
- The adapter keeps the same `id`, `createdAt`, `updatedAt`, and `deletedAt`.
- The adapter places the current Spark text into `sparkText`, starts notes,
  workshop, and final text empty, and preserves `stage` only as legacy metadata.
- Documented that old Spark records contain only one current text layer, so
  Writer cannot reconstruct historical original sparks from already edited old
  records.
- No storage key changes, no Writer DB schema change, no Google Drive sync
  payload change, no automatic migration, and no UI behavior change.

## 2026-07-13

- Added the first "four notebooks" workflow as an optional spark `stage`:
  `spark`, `notes`, `workshop`, and `final`.
- Old sparks without `stage` are treated as **Iskra**.
- Added simple list filters for **Všetko**, **Iskry**, **Poznámky**,
  **Dielňa**, and **Text OK**.
- Added a subtle stage badge on each spark card.
- Added a small **Zošit** selector when editing a saved spark.
- Changing stage keeps the same `id` and `createdAt`, updates `updatedAt`, and
  marks local changes as pending for Svitok sync.
- Kept draft recovery scoped to new unsaved sparks only.
- Kept manual JSON export/import, Google Drive sync, sync-safe delete
  tombstones, and sync backups on the existing storage path.

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
- Added local autosave and recovery for a new unsaved spark.
- Added a local draft key:
  `lassilab-writer:v0.1:draft:new-spark`.
- Added a gentle recovery card with **Obnoviť** and **Zahodiť** actions.
- The new spark draft is local only, is not synced, is not part of manual DB
  export/import, and is cleared after a successful spark save.
- Clarified existing spark editing in the UI: saved sparks open into edit mode,
  the author sees that an existing spark is being edited, **Uložiť zmeny**
  keeps the original `id` and `createdAt`, and `updatedAt` moves forward.
- Kept new-spark draft recovery separate from existing spark editing.
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
