# Implementation Plan

## Current Product Direction

The Writer DB runtime cutover is published at
`aa2c631022269e63cf3615d8cc4dae9d07b264c3`. The import path is no longer the
active product-development priority. Google Drive remains v1/Sparks-only.

The product inventory and future information architecture are defined in
`WRITER_PRODUCT_ARCHITECTURE_REVIEW.md`. The published Phase B1 slice adds only
a pure WriterPackage-catalog-to-Library view-model adapter and artificial
checks. B1 is published at `4158a9ebc491886b44ae171e5d1130b504f9fe06`.

Phase A is implemented as a separate static `Knižnica / Dielňa / Dáta` entry
using fixture data and no production storage wiring. Manual PC and mobile review
approved the architecture as a baseline, not as a final visual design. Do not
connect the shell to real data without a separate Phase B decision.

The Phase B read-only boundary is specified in
`WRITER_LIBRARY_READ_ONLY_REVIEW.md`. The B1 pure adapter accepts an already
supplied catalog and does not call `loadWriterPackageCatalog()`. B2 is
published at `207801b17665a7669ffe52adb4887b5ed262b6b9` as a read-only provider
that calls one injected loader and passes its result to B1. It has no write
surface. B3 is published at `1fd2ac05065022a3a0a3d95307324b3bcbb34bd7` as
the development-only, non-persistent fixture/real-read-only selector. B4 is
published at `08b06848e712bac3499d397e50cee5ca4c62a439`: exact DEV
real-read-only mode injects the existing catalog loader into B2 once before
React render and displays a read-only Knižnica; fixture and production behavior
remain unchanged. The docs-only B5 contract is defined in
`WRITER_LIBRARY_READ_ONLY_DETAIL_REVIEW.md`. It recommends evolving the same B2
ready result into one immutable `items + detailsById` snapshot built from that
single catalog load. B5.1 is published at
`bbdebc1779faeb355d785245780f9f11e0aa0b64` as a pure, deeply immutable
WriterPackage-to-detail adapter plus a tombstone-filtering, order-preserving
detail-array builder. B5.2 is published at
`8ec9fe3431ee71aab78085cca07661dc25c31633` as the pure snapshot builder and
one-load B2 provider result. Local B5.3 adds only a pure immutable selection and
layer model with safe `missing-detail` resolution over `snapshot.detailsById`.
It is not connected to React, so B4 still reads only `snapshot.items` and real
cards remain inactive. The smallest future code slice is B5.4, the separately
reviewed read-only detail UI.

## Completed v0.1 Slice

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
10. Add a read-only recovery inspection for a remaining prepared marker. Done
   as an injected, headless diagnostic function with `clean`, `recoverable`,
   and `blocked` results; it does not write, rollback, remove markers, touch UI,
   or use runtime localStorage directly.
11. Specify the explicit manual v1/v2 import preview and confirmation flow.
   Done as documentation only: file selection is read-only, confirmation is
   explicit, preview is recomputed against fresh local data before any write,
   and failure copy distinguishes no write, successful rollback, and failed
   rollback. Runtime UI remains unimplemented.
12. Implement the smallest import UI state shell and read-only file-to-preview
   path. Prepared locally with separate idle/reading/ready/blocked states,
   complete local Sparks, real WriterPackages, no active import command, and no
   merge, persistence, recovery action, or production storage write.
13. Add a pure confirmation preflight with recovery gate, fresh preview
   recomputation, and meaningful stale detection. Prepared locally without UI,
   storage access, merge, backup, persistence, or rollback.
14. Wire recovery-gated ready/stale/blocked results into the preview shell.
   Prepared locally with a read-only readiness action, refreshed preview display,
   get-only recovery storage injection, and no import execution or persistence.
15. Design and test an explicit pure import execution function outside App.tsx
   before any runtime button or storage wiring. Prepared locally as a
   deterministic preflight -> merge -> original-state backup plan. It returns
   ready/stale/blocked data but performs no persistence and creates no marker.
16. Add a separate import execution coordinator with injected storage, first
   only in harness checks and still without App.tsx wiring. Prepared locally:
   it reuses the execution plan and persistence coordinator, verifies both
   stored collections before success, and preserves persistence rollback
   ownership and reporting.
17. Design the manual runtime confirmation and success/failure UI contract
   without enabling it yet. Documented locally with a single discriminated
   state model, confirmed-preview invalidation, one-click execution lock,
   truthful coordinator result copy, and reload/recovery rules.
18. Implement and test the final UI state transitions as a pure helper, still
   without App.tsx execution wiring. Prepared locally with explicit
   accepted/rejected results, deterministic preview revisions, importing
   guards, coordinator-result mapping, and safe-close derivation.
19. Add a separate adapter between App.tsx and the pure state machine, first
   without calling `executeWriterDbImport` or exposing an active import action.
   Prepared locally as a pure typed result-to-event mapper with explicit stale
   revisions and state-machine rejection guards. The existing read-only
   preview/readiness runtime is now wired to it with one authoritative UI state,
   canonical semantic preview revisions, and no import execution.
20. Replace the legacy production importer with the coordinated path in one
   explicitly reviewed final runtime cutover; activate one import action and do
   not keep two active import truths. Completed and published at `aa2c631` with
   284/284 Writer DB checks.
21. Only then design Google Drive v2 sync.
22. Only after v2 sync is safe, start creating WriterPackages from production UI.
23. Only after packages exist safely across devices, build the workspace UI.

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
- Recovery inspection is diagnostic only. A missing marker is `clean`; a valid
  marker plus compatible valid backup is `recoverable`; damaged marker or
  backup state is `blocked`. Damaged current collections and target-count
  mismatches are warnings when the backup remains valid.
- File selection must never trigger import. A blocked preview has no import
  action, cancellation changes nothing, and one explicit in-preview
  confirmation replaces browser confirmation dialogs.
- Confirmation must reload local collections and recompute preview. If the
  preview differs, return to the updated preview without merging, backing up,
  or writing.
- A remaining recoverable or blocked transaction marker must prevent a new
  import until the earlier operation is resolved; this rule does not authorize
  recovery UI or automatic rollback.

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

## Published Atomic Import Cutover

The production-facing UI cutover is published as one coordinated v1/v2 path at
`aa2c631`. The state machine is authoritative; only an accepted
`import-started` transition can reach the runtime adapter and coordinator.
Startup and pre-execution recovery inspection block unresolved markers. The
legacy App route was removed in the same cutover. Production is READY; Google
Drive remains v1/Sparks-only.
