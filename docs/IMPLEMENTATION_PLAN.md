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
- `deletedAt`
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

`deletedAt` is optional and works as a sync-safe tombstone. Deleted sparks are
hidden from normal UI lists, but remain in the DB export/sync payload. Deleting
a spark sets both `deletedAt` and `updatedAt` to the current timestamp so the
same merge rule can propagate deletes across devices.

The Google Drive sync stores the same Writer DB shape in:

- `lassilab-writer-db-v001.json`
- Google Drive `appDataFolder`

Sync also merges by `id`, keeps the newer `updatedAt`, avoids duplicates, and
backs up local sparks before applying a remote merge.

## Writer DB v2 Rollout Plan

Writer DB v2 is the proposed future export/import/sync envelope for carrying
both legacy Sparks and WriterPackages.

Proposed shape:

```ts
type WriterDbV1 = {
  app: "LassiLAB Writer";
  schemaVersion: 1;
  exportedAt: string;
  sparkCount: number;
  sparks: Spark[];
};

type WriterDbV2 = {
  app: "LassiLAB Writer";
  schemaVersion: 2;
  exportedAt: string;
  sparkCount: number;
  packageCount: number;
  sparks: Spark[];
  packages: WriterPackage[];
};

type WriterDb = WriterDbV1 | WriterDbV2;
```

Small commits:

1. Add TypeScript types and validators for `WriterDbV2`. Done as read-only
   foundation in `src/writerDb.ts`.
2. Add a read-only parser that accepts v1 and v2. Done locally without changing
   production import/export behavior.
3. Add manual v2 export. Done as a separate test action; v1 export/import and
   Google Drive sync remain unchanged.
4. Add a read-only/local Writer DB v2 round-trip test harness. Done without
   production UI, import, sync, or storage writes.
5. Design manual v1/v2 import preview, backup, in-memory merge, validation, and
   guarded write contracts. Done as documentation only; no runtime import path
   changed.
6. Implement and test pure `previewWriterDbImport` without UI or storage access.
   Done with read-only v1/v2 collection counts, warnings, blocking duplicate-id
   checks, and no merge or persistence.
7. Implement and test pure `mergeWriterDbInMemory` without storage writes.
   Done with blocked-preview rejection, stable ordering, deep copies, result
   validation, v1 Packages untouched, and independent v2 collection merges.
8. Implement and test pure `createWriterDbImportBackup` without persistence.
   Done with complete two-model snapshots, input validation, canonical ISO time,
   duplicate-id rejection, and deep-copy isolation.
9. Add the unified backup storage adapter and a small prepared transaction
   marker, then test rollback and interrupted-write recovery. Prepared locally
   as an injected, headless persistence coordinator; production import remains
   unchanged.
10. Add an explicit manual v1/v2 import preview UI only after the pure and
   persistence layers pass their checks.
11. Only then design Google Drive v2 sync.
12. Only after v2 sync is safe, start creating WriterPackages from production UI.
13. Only after packages exist safely across devices, build the workspace UI.

Rules:

- v1 import keeps working.
- v1 import merges Sparks only.
- v1 import must not delete or overwrite WriterPackages.
- v2 import merges Sparks and WriterPackages.
- Missing records never mean deletion.
- `deletedAt` tombstones and newer `updatedAt` wins remain the conflict rules.
- `sparkCount` and `packageCount` are informational; arrays are source of truth.
- No automatic Spark-to-Package migration.
- No production Google sync payload change until v2 rollout is explicitly
  planned and tested.
- The parser is read-only and must not persist, migrate, or partially accept a
  corrupted payload as if it were healthy.
- v2 import must not write while parsing or previewing. It should write only
  after a valid payload is parsed, the merge result is previewed, local Sparks
  and WriterPackages are backed up, and the merge has succeeded in memory.
- Count mismatches and Spark/WriterPackage cross-model id overlap are warnings;
  duplicate ids inside one incoming collection block import as ambiguous.
- The future unified import backup uses
  `lassilab-writer:v0.1:writer-db:backup-before-import`; it must not change the
  existing Spark-only import backup key or payload.
- Because localStorage cannot atomically write both model keys, a prepared
  transaction marker and validated rollback backup are required before v2
  import can write production data.
- The coordinator must validate the backup before the marker, validate every
  critical write by reading it back, restore both collections after a partial
  failure, and preserve the marker when rollback fails.

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
