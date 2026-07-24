# Worklog

## 2026-07-24 - Phase B5.2 immutable read-only Library snapshot (local only)

- Added a pure `WriterLibraryReadOnlySnapshot` builder that creates the
  published B1 items and B5.1 details from the exact same supplied catalog.
- Added a frozen null-prototype `detailsById` lookup, verified one detail per
  visible item, and rejected invalid duplicate IDs instead of silently
  overwriting a detail.
- Evolved the existing B2 ready result to expose the snapshot after exactly one
  injected loader call. Existing empty and `failed/catalog-load-failed`
  behavior remains stable; that public failure intentionally covers both loader
  errors and snapshot construction or invariant-validation failures.
- Kept B4 presentation on `snapshot.items` only. No selection, detail UI,
  React state, second load, storage call, write, migration, or production
  wiring was added.
- Added 28 artificial snapshot checks and 3 static isolation checks. The full
  product-shell harness now passes 143/143; existing B1, B2, B4, and B5.1 test
  counts remain unchanged.
- Local only: not staged, committed, pushed, or deployed. The next separately
  reviewed step is B5.3, the local selection model.

## 2026-07-24 - Phase B5.1 pure read-only detail adapter

- Added a pure `WriterPackage -> WriterLibraryDetail` adapter that copies only
  presentation fields and reuses B1 title/origin rules.
- Copied live notes into new frozen objects, excluded deleted notes, preserved
  empty live notes and note order, and kept each layer text exact without
  fallback copying.
- Added a pure frozen detail-array builder that filters top-level tombstones and
  preserves catalog order without sorting, deduplication, or collision logic.
- Added 24 artificial detail checks and 3 static isolation checks. The complete
  product-shell harness now passes 112/112 while the existing B1-B4 totals stay
  unchanged.
- B5.1 reads no storage, browser global, current time, randomness, network, or
  Google Drive. Its module does not create `detailsById` or import B2, React,
  ProductShell, or production App; B5.2 now consumes its pure result.
- Published at `bbdebc1779faeb355d785245780f9f11e0aa0b64`. Its detail mapping
  contract remains pure and unchanged by B5.2.

## 2026-07-23 - Phase B5 read-only detail contract (docs only)

- Inventoried the published B4 path from the single injected
  `loadWriterPackageCatalog()` call before React render through the B2 provider
  and into the real read-only Library component.
- Confirmed that B2 currently returns only `WriterLibraryItem[]`; the local
  catalog variable and full layer content are not available after mapping, and
  disabled B4 cards have no click behavior.
- Recommended evolving the existing B2 ready result into one deeply immutable
  snapshot containing B1-ordered items and a read-only detail index built from
  the same catalog load. A second provider, raw WriterPackages in React,
  `getWriterPackageById()`, and reload-on-click are rejected.
- Defined pure detail types, local ID-only selection, PC and mobile read-only
  Dielňa behavior, truthful legacy/empty/error states, privacy boundaries,
  checks, and B5.1-B5.5 review gates in
  `WRITER_LIBRARY_READ_ONLY_DETAIL_REVIEW.md`.
- Documentation only. No runtime, React, CSS, provider, storage, production App,
  commit, push, or deploy is part of this review.

## 2026-07-23 - Phase B4 real read-only Library

- Added a small assembly boundary that calls the published B2 provider exactly
  once before React render only in exact DEV `real-read-only` mode.
- Injected the existing `loadWriterPackageCatalog()`; fixture mode calls
  neither the provider nor loader and retains its three fixture packages.
- Rendered B1-ordered items, one `Pokračovať` item, human progress and
  `Pôvodná Iskra` labels, plus truthful empty and failed states.
- Kept `Nová iskra` and real cards inactive. No real package opens, no selected
  ID is stored, and B5 detail does not exist.
- Added only artificial assembly/presentation checks. Production App, storage
  implementation, Writer DB, and Google Drive remain unchanged. Published as
  `08b06848e712bac3499d397e50cee5ca4c62a439` after 85/85 product-shell checks,
  284/284 Writer DB checks, both builds, an isolated synthetic catalog test,
  and production smoke verification passed.

## 2026-07-22 - Phase B3 development-only data mode

- Added a pure, deterministic resolver for fixture and `real-read-only` modes
  from injected development state and query text.
- Kept fixture mode as the default and failed closed for production, absent,
  blank, unknown, malformed, and case-mismatched query values.
- Limited `import.meta.env.DEV` and `window.location.search` reads to the
  isolated product-shell entry; the resolver has no browser or storage access.
- Added a truthful development placeholder that loads neither fixtures nor the
  B2 provider in real-read-only mode. It performs no catalog or storage read.
- Kept production App, navigation, storage, Writer DB, and Google Drive outside
  B3. Published as `1fd2ac05065022a3a0a3d95307324b3bcbb34bd7` after resolver,
  isolation, build, and five-URL browser checks passed.

## 2026-07-22 - Phase B2 read-only Library provider

- Added a typed read-only provider that receives a synchronous WriterPackage
  catalog loader by dependency injection and calls it exactly once.
- Passed the returned catalog directly to the published B1 view-model adapter;
  B2 adds no collision, Spark adaptation, sorting, filtering, or migration
  rule of its own.
- Added stable `ready` and `failed/catalog-load-failed` results without stack
  traces, data logging, global state, storage, or write methods.
- Kept the documented limitation that an empty current catalog result cannot
  distinguish damaged loader data from a genuinely empty Library.
- Used only artificial catalogs and loaders in provider checks. B2 is not
  connected to React, `ProductShellPrototype`, production storage, Google
  Drive, import/export, persistence, or recovery.
- Published as `207801b17665a7669ffe52adb4887b5ed262b6b9` after product-shell,
  Writer DB, build, immutability, injected-loader, and isolation checks passed.

## 2026-07-22 - Phase B1 pure Library view model

- Added a pure catalog-to-`WriterLibraryItem` adapter using the existing
  `WriterPackage` type and only artificial checks.
- Added deterministic title, excerpt, progress, live-note, tombstone, and
  updated-time sorting rules with an ascending ID tie-break.
- Kept physical storage provenance out of the view model; `legacy.source`
  becomes only the human-facing historical origin `legacy-spark`.
- The adapter accepts an already supplied catalog and does not call
  `loadWriterPackageCatalog()`, React, browser globals, storage, current time,
  network, Google Drive, import, export, persistence, or recovery.
- B1 is not connected to `ProductShellPrototype`, production UI, or real data.
  B2 remains the next separately reviewed read-only provider step.
- Published as `4158a9ebc491886b44ae171e5d1130b504f9fe06` after the product-shell,
  Writer DB, build, immutability, and side-effect checks passed.

## 2026-07-21 - Phase B read-only Library review (docs only)

- Inspected the current Spark, WriterPackage, package catalog, same-ID,
  tombstone, and legacy-adapter contracts from their source implementations.
- Recommended `loadWriterPackageCatalog()` as the read-only Library source so
  existing legacy Sparks do not disappear.
- Defined a pure Library view model, read-only Knižnica and Dielňa behavior,
  human empty/error copy, privacy rules, and B1-B5 implementation gates.
- Kept fixture mode as the default and specified an explicit development-only,
  non-persistent real-data mode behind an injected loader.
- Documented that current loaders cannot distinguish malformed JSON from an
  empty collection and that `getWriterPackageById` is not a universal path for
  adapted legacy items.
- No runtime, product-shell, CSS, storage, migration, import/export, recovery,
  Google Drive, commit, push, or deployment change was made.

## 2026-07-21 - Isolated Writer product shell prototype

- Added a separate development HTML entry for the product shell; production
  `index.html`, `main.tsx`, and `App.tsx` remain unchanged.
- Added fixture-only Knižnica, Dielňa, and Dáta views with simple local UI
  navigation and no URL router.
- Added a desktop active-plus-context workspace and a mobile one-panel layout
  for Iskra, Poznámky, Dielňa, and Text OK.
- Added only artificial package and note content. Prototype edits live in local
  React state and may disappear on reload.
- Added separate product-shell model and isolation checks outside the Writer DB
  harness.
- No production storage, Spark, WriterPackage, Google Drive, import, export,
  recovery, persistence, data key, migration, or deployment behavior changed.
- Manual PC and mobile review approved Knižnica / Dielňa / Dáta and the desktop
  and mobile workshop layouts as the baseline for further development.
- The prototype is not a final visual design, and real-data wiring has not
  started.

## 2026-07-21 - Writer product architecture review (docs only)

- Audited the current production structure, App shell, Spark workflow,
  WriterPackage foundation, storage boundaries, and existing UX documentation.
- Defined the next product model as one creative package with one stable ID and
  four connected layers: Iskra, Poznámky, Dielňa, and Text OK.
- Proposed three primary destinations: Knižnica, contextual Dielňa, and Dáta.
- Moved import/export, Google connection, sync, recovery, and diagnostics out
  of the future creative workspace in the information architecture only.
- Added PC two-panel and mobile one-panel workflow rules, six text wireframes,
  a legacy-stage recommendation, and phased migration gates A-F.
- No runtime, CSS, storage, data format, import, recovery, export, Google Drive,
  commit, push, or deployment change was made.

## 2026-07-19 - Read-only Writer DB state-machine runtime wiring

- Replaced the preview/readiness path's parallel ad-hoc React state with the
  published `WriterDbImportUiState` and typed adapter mappings.
- File selection, preview preparation, readiness results, and reset now pass
  through state-machine transitions; rejected transitions keep current state.
- Added a pure canonical semantic preview revision with no time, randomness,
  storage, browser API, or input mutation.
- Added 15 read-only runtime integration checks, bringing the harness to 269.
- Preserved the current preview layout and copy, same-file reselection, get-only
  recovery inspection, and fresh Sparks plus real WriterPackages preflight.
- No `executeWriterDbImport`, active import action, merge, backup, persistence,
  rollback, new storage key, legacy import change, or Google Drive sync change
  was added.

## 2026-07-19 - Pure Writer DB import UI adapter

- Added a typed, React-free adapter from file/preview/preflight/start/coordinator
  results and reset requests to the existing UI state-machine events.
- Stale results carry an explicit refreshed revision; blocked and failed
  results preserve reasons, issues, rollback facts, and marker truth.
- Added 22 adapter checks, bringing the Writer DB harness to 254 checks.
- The adapter delegates every transition to the state machine, so revision,
  importing, and safe-close guards remain authoritative.
- No App.tsx wiring, active import, parser call, merge, backup, persistence,
  recovery, rollback, storage, network, production import/export, or Google
  Drive sync change was added.

## 2026-07-19 - Pure Writer DB import UI state machine

- Added a React-free discriminated state/event helper with explicit accepted or
  rejected transition results.
- Preview and confirmed revisions are deterministic caller inputs. A stale,
  blocked, reset, or new-file transition drops confirmation, and an old
  revision cannot start importing.
- Importing accepts only coordinator result events and rejects a second start,
  file selection, reset, preview events, and preflight events.
- Success can arise only from importing plus a typed coordinator success.
  Stale/blocked return to preview states and failure keeps the typed coordinator
  result.
- Safe close is derived from persistence stage, rollback truth, and definitely
  absent marker state; verification, failed rollback, remaining marker, and
  unknown marker remain unsafe.
- Added 34 pure state checks while preserving all existing 198 checks.
- No App.tsx, CSS, coordinator, persistence, recovery, storage, import/export,
  Google Drive, active import action, or runtime side effect was added.
- The next smallest step is a thin App.tsx-to-state-machine adapter tested
  without calling `executeWriterDbImport`.

## 2026-07-19 - Final manual Writer DB runtime confirmation contract

- Documented the final file -> preview -> readiness -> confirmed import ->
  coordinator result flow without enabling runtime execution.
- Only `import-confirm-ready` may expose **Importovať databázu**. It owns the
  confirmed preview revision/fingerprint; any stale, blocked, reset, file, or
  recovery change discards confirmation.
- The first press enters locked `importing` synchronously, disables cancel and
  file actions, and prevents a second coordinator call.
- Success is created only from coordinator success after final read-back.
  Stale, blocked, persistence, rollback, and verification copy never pretends
  that an import succeeded.
- Documented that verification failure does not always leave a marker. Reload
  authority comes from recovery inspection and the truthfully reported marker
  state, never React state alone.
- Added PC/mobile behavior, the complete manual scenario plan, and the rollout
  recommendation to replace the legacy importer with the coordinated path in
  one reviewed runtime change.
- Documentation only: no App.tsx, CSS, TypeScript, storage, import/export,
  persistence, recovery, or Google Drive change.

## 2026-07-19 - Injected-storage Writer DB import coordinator

- Added `executeWriterDbImport` as the single future connection between the
  pure execution plan and the existing persistence coordinator.
- Stale and blocked plans return before persistence. Ready passes the existing
  original-state backup and merged collections without creating another backup.
- Persistence remains the sole owner of transaction marker writes and rollback;
  its stage and rollback flags are preserved in coordinator failures.
- Success now requires an independent injected-storage read-back, existing
  Writer DB parser validation, and equality with both prepared merged arrays.
- Success summary is created only after verification and retains the confirmed
  preview semantics, including incoming tombstone counts.
- Added 24 coordinator checks while preserving all existing 174 checks.
- No App.tsx, CSS, production storage, import/export, Google Drive sync, runtime
  storage key, or active import action was changed.
- The next smallest step is designing manual confirmation and success/failure UI
  behavior without enabling runtime execution.

## 2026-07-19 - Pure Writer DB import execution plan

- Added `prepareWriterDbImportExecution`, a pure orchestration of confirmation
  preflight, in-memory merge, and original-state backup creation.
- Stale and blocked preflight results return before merge or backup. Only a
  ready preflight can calculate merged Sparks and WriterPackages.
- Backup creation receives the original local arrays and an explicit timestamp,
  so it is deterministic and cannot capture already merged data.
- Ready means only that the plan is prepared; persistence, marker writes,
  rollback, read-back verification, and success summary remain disconnected.
- Added 26 execution checks while preserving all existing 148 checks.
- No App.tsx, CSS, production storage, import/export, Google Drive sync, runtime
  storage key, or active import action was changed.
- The next smallest step is an injected-storage execution coordinator tested
  only in the harness and still not wired into App.tsx.

## 2026-07-19 - Read-only import readiness UI

- Added **Skontrolovať pripravenosť** to the existing preview without adding an
  import action.
- The action reloads complete Sparks and real WriterPackages, injects a
  get-only localStorage adapter into recovery inspection, and runs pure preflight.
- Ready confirms only that the preview is current; stale displays the refreshed
  preview and requires another readiness check.
- Recovery-required, recovery-blocked, and newly blocked preview results show
  human-readable blocked states with no writes or recovery action.
- Added 10 pure UI transition checks while preserving the existing 138 checks.
- No merge, backup, persistence, rollback, migration, new storage key, active
  import action, production import change, or Google Drive change was added.

## 2026-07-19 - Pure Writer DB import confirmation preflight

- Added a pure preflight that receives recovery inspection and fresh local
  collections as inputs without reading storage.
- `recoverable` and `blocked` recovery states prevent a new import preparation;
  `clean` recomputes preview from current Sparks and WriterPackages.
- Meaningful preview comparison returns `ready`, `stale`, or `blocked` and
  includes counts, modes, warnings, and blocking issues.
- A stale result carries previous and refreshed previews and requires renewed
  confirmation before any future execution.
- Added 16 preflight checks while preserving the existing 122 checks.
- No App.tsx wiring, active import action, merge, backup, persistence, rollback,
  marker write, storage key, migration, or Google Drive change was added.

## 2026-07-19 - Read-only Writer DB import preview shell

- Added a separate **Náhľad importu DB v1/v2** action without changing the
  existing production import action.
- Added a pure helper that parses JSON and returns a ready or blocked preview
  without merge, backup, persistence, recovery inspection, or localStorage.
- Preview compares incoming records with complete local Sparks and real
  WriterPackages, not the legacy-adapted package catalog.
- Added idle, reading, ready, and blocked UI states with resettable file input,
  human-readable warnings, responsive counts, and no active import command.
- Added 15 preparation checks while preserving the previous 107 checks.
- Import execution, recovery gate, fresh-preview confirmation, success,
  rollback, storage keys, migration, and Google Drive v2 sync remain unconnected.

## 2026-07-19 - Manual Writer DB import UX contract

- Documented the manual v1/v2 path from file selection through read-only
  preview, explicit confirmation, guarded execution, and human-readable result.
- File selection and cancellation never change data; blocked previews never
  expose an import action.
- Confirmation must reload current Sparks and WriterPackages and recompute the
  preview. A stale preview returns to review without writing.
- Defined a discriminated UI state model plus Slovak copy for ready, blocked,
  success, pre-write failure, successful rollback, and failed rollback states.
- Defined PC two-column and mobile single-panel layouts without wide tables.
- A remaining recoverable or blocked transaction marker will prevent a new
  import, but recovery UI and automatic rollback remain future work.
- Documentation only: no App.tsx, runtime component, production import/export,
  storage key, Google Drive sync, migration, or per-note merge change.

## 2026-07-17 - Read-only Writer DB recovery inspection

- Added `inspectWriterDbRecovery` with explicit `clean`, `recoverable`, and
  `blocked` results.
- The inspection reads only injected storage and never calls `setItem` or
  `removeItem`.
- A valid marker and complete backup remain recoverable even when current
  Sparks or WriterPackages are damaged; those conditions produce warnings.
- Unknown marker/backup versions, missing or invalid backup data, duplicate
  backup ids, and source-schema mismatch block recovery inspection.
- Added 20 recovery checks while preserving all previous 87 checks.
- Covered matching v1 marker/backup recovery, duplicate backup id blocking,
  and current collection read failures as warnings.
- No recovery UI, rollback, marker removal, production storage wiring,
  migration, or Google Drive sync change was added.

## 2026-07-17 - Writer DB persistence coordinator foundation

- Added `src/writerDbPersistence.ts` with injected key-value storage and
  explicit Sparks, Packages, backup, and transaction keys.
- The coordinator validates all inputs and serializes all values before the
  first write.
- It writes and validates the complete backup before creating a prepared
  transaction marker.
- Sparks and WriterPackages are written separately and validated by read-back.
- Partial failures attempt to restore both collections from the backup. A
  failed rollback leaves the transaction marker for a future recovery step.
- Added 21 in-memory persistence checks without using browser localStorage.
- Production import, App.tsx, Google Drive sync, and automatic migration remain
  unchanged and disconnected from this coordinator.

## 2026-07-16 - Pure Writer DB import backup factory

- Added `WriterDbImportBackup`, `CreateWriterDbImportBackupInput`, and the
  discriminated `WriterDbImportBackupResult`.
- Added pure `createWriterDbImportBackup` with no storage access or persistence.
- Backed up complete local Sparks and WriterPackages for both v1 and v2 source
  versions, including tombstones, stage, tags, notes, deleted notes,
  workshop/final text, and legacy metadata.
- Validated source schema, optional deterministic time, every record,
  `packageVersion`, and same-collection id uniqueness before creating a backup.
- Deep-copied arrays and nested values in both directions so later mutation of
  backup or input cannot affect the other side.
- Extended `npm run check:writer-db` from 47 to 66 checks: 13 parser/export, 14
  preview, 20 in-memory merge, and 19 backup factory checks.
- No backup persistence, runtime storage key, transaction marker, rollback, UI,
  production import, migration, or Google Drive sync behavior was added.
- The next smallest step is a guarded persistence coordinator with validated
  backup write/read-back and a prepared transaction marker, still without UI.

## 2026-07-16 - Pure Writer DB v1/v2 in-memory merge

- Added discriminated `WriterDbInMemoryMergeResult` and pure
  `mergeWriterDbInMemory`.
- Reused import preview and rejected blocked previews before merge.
- Preserved local record positions, replaced newer records in place, kept
  equal/older local records, and appended new records in incoming order.
- Applied the same top-level `updatedAt` rule to active records and tombstones.
- Kept v1 WriterPackages unchanged and merged v2 Sparks and WriterPackages as
  independent collections, with no per-note merge.
- Deep-copied Spark tags, WriterPackage notes, and legacy metadata so result
  mutation cannot change incoming or local inputs.
- Validated resulting records, `packageVersion`, and same-collection id
  uniqueness before returning success.
- Extended `npm run check:writer-db` from 27 to 47 checks: 13 parser/export, 14
  preview, and 20 in-memory merge checks.
- No localStorage access, backup persistence, transaction marker, rollback, UI,
  production import, migration, or Google Drive sync behavior was added.
- The next smallest step is a pure backup builder and validator, followed by a
  guarded write coordinator that is still developed without UI first.

## 2026-07-16 - Pure Writer DB v1/v2 import preview

- Added pure `previewWriterDbImport` with explicit parsed DB, local Sparks, and
  local WriterPackages inputs.
- Added deterministic create, update, unchanged, ignored-older, and incoming
  tombstone counts for v1 and v2.
- Kept v1 WriterPackages in `untouched` mode and compared v2 Sparks and
  WriterPackages as independent collections.
- Added informational warnings for count mismatch, v1 untouched Packages,
  tombstones, empty imports, and same ids across models.
- Added blocking issues only for duplicate ids inside one incoming collection.
- Extended `npm run check:writer-db` from 13 to 27 checks, including preview
  immutability and a throwing localStorage guard.
- No merge, backup, rollback, transaction marker, UI, production import, or
  Google Drive sync behavior was added.
- The next smallest step is pure `mergeWriterDbInMemory`, still without any
  localStorage access or production UI.

## 2026-07-16 - Writer DB v1/v2 import safety contract (docs only)

- Documented a deterministic read-only preview model for manual Writer DB v1
  and v2 imports.
- Defined create, update, unchanged, ignored-older, and tombstone rules using
  top-level `updatedAt`; v1 leaves WriterPackages untouched and v2 evaluates
  both models independently.
- Defined informational warnings for count mismatch, tombstones, empty imports,
  v1 untouched Packages, and cross-model id overlap.
- Defined duplicate ids inside one incoming collection as a blocking ambiguity.
- Defined a complete Sparks plus WriterPackages backup envelope and recommended
  `lassilab-writer:v0.1:writer-db:backup-before-import`, preserving the existing
  Spark-only backup key and payload.
- Documented pure preview, backup-builder, and in-memory merge boundaries.
- Documented a minimal localStorage recovery journal using a validated backup,
  prepared transaction marker, read-back validation, and explicit recovery.
- No runtime code, UI, production import, storage key, migration, or Google
  Drive sync behavior changed in this documentation-only step.
- The smallest implementation step is pure preview logic plus local checks,
  still without storage writes or UI changes.

## 2026-07-16 - Writer DB v2 read-only check harness

- Added a small local Writer DB v2 check harness with no test framework.
- Added `npm run check:writer-db` for read-only round-trip payload validation.
- Covered empty payloads, Sparks, staged Sparks, deleted Sparks,
  WriterPackages, package notes, deleted notes, shared Spark/Package ids,
  informational count mismatches, invalid JSON, unknown schema versions, and
  corrupted Spark/WriterPackage records.
- Checked that v2 payload creation and parsing do not mutate input arrays or
  payload objects and do not touch localStorage.
- Kept production UI, v1 export/import, Google Drive sync, storage keys, and
  runtime behavior unchanged.
- No v2 import merge, backup flow, migration, or Google sync v2 path exists yet.
- Next v2 import work should proceed in order: parser, preview result, backup
  Sparks and Packages, merge in memory, then write.

## 2026-07-16 - Manual Writer DB v2 test export

- Added a separate manual Writer DB v2 test export action.
- Added a pure v2 payload builder that includes current Sparks and
  WriterPackages without changing their order.
- Derived `sparkCount` and `packageCount` from the exported arrays.
- Validated the v2 payload before download through the existing Writer DB
  parser path.
- Export creates `LassiLAB_Writer_DBv002_YYYY-MM-DD.json`.
- Kept the existing v1 manual export and v1 import unchanged.
- Kept Google Drive sync on `lassilab-writer-db-v001.json`.
- No localStorage keys changed, no migration ran, and no v2 import was enabled.

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

## 2026-07-20 — local Writer DB runtime cutover

- Replaced the two active import UI truths with one coordinated v1/v2 flow.
- Removed the legacy App button, file input, and handler; left the unreachable
  `storage.ts` helper unchanged for a later low-risk cleanup.
- Added an injected runtime adapter for time, opaque transaction ID, storage,
  existing keys, startup recovery inspection, and fresh pre-execution gating.
- Added importing, success, stale, typed blocked, and truthful failed UI.
- Added 15 runtime controls; the local harness is 284/284.
- Google Drive stays v1/Sparks-only. No new key, migration, recovery action,
  push, or deployment was made; the cutover stays on a local branch.
- Runtime return baseline: `24c6b71311ba89d5ce2b12d762a8332691fb351e`.

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
