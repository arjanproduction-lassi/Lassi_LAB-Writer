# Worklog

## 2026-08-19 - R2.6.3c2b2b4 first production read

- Confirmed a clean published `main` at
  `ead4025bedd1af5ed1801c484b8f32e84af22a6a` and a ready production deployment
  before the manual gate.
- Received explicit visible-chat approval for c2b2b4 immediately before the
  first production **Pripraviť lokálnu zálohu** click in the intended browser
  profile.
- The UI reached `snapshot-ready` and showed only text-free counts: 0 Sparks, 0
  WriterPackages, and 0 notes. No raw author content was displayed or recorded.
- The UI truthfully reported that the snapshot remained only in memory and no
  file was created or downloaded. The reviewed path performs no storage write,
  Drive/network call, deletion, migration, tombstone, reset, purge, or R3
  action.
- This docs-only closeout stores no screenshot, raw snapshot, storage value,
  author text, secret, token, or production artifact. R2.6.3d remains a separate
  future review and implementation gate.

## 2026-08-19 - R2.6.3c2b2b3 App placement

- Added a pure four-boolean blocking-reason helper with stable import,
  non-clean recovery, active Google sync, then editor/draft precedence.
- Added exactly one existing retirement panel to `App.tsx` after Writer DB
  import UI and before Google sync. App passes only the production factory
  reference and the text-free blocking reason.
- Added no App state, effect, ref, timer, listener, handler, storage key, CSS,
  route, navigation, product-shell, import/export, recovery, persistence, or
  Google sync behavior.
- Added 41/41 synthetic helper and App source/isolation checks; the combined
  retirement harness passes 776/776. Tests do not import/render App or invoke
  the production factory/prepare path.
- No real retirement localStorage read, storage write, Drive/network call,
  backup/file creation, deployment, or c2b2b4 first click occurred.

## 2026-08-19 - R2.6.3c2b2b3 App placement review (docs only)

- Added `WRITER_LEGACY_SPARK_APP_PLACEMENT_REVIEW.md` without App/React/CSS,
  runtime, test, storage, import/export, recovery, persistence, Google Drive,
  commit, push, deployment, or real-data changes.
- Chose exactly one future panel position after all Writer DB import UI and
  before the existing Google sync panel in **Dáta / Ručný prenos DB**.
- Defined one pure four-boolean guard boundary over existing App state with
  stable precedence: active import, recovery not clean, active Google sync,
  then editor or draft active.
- App will pass only the published production factory reference and one
  text-free blocking reason. It will not call the factory, controller, c2a,
  c2b1, Date, or localStorage for retirement.
- c2b2b4 remains the separately approved first real click. This review does
  not make the panel visible and performs no real storage read.

## 2026-08-19 - R2.6.3c2b2b2 production composition

- Added one thin non-React runtime module that composes the existing c2b2a
  controller, c2b1 session, canonical UTC-second timestamp adapter, and c2a
  browser capture wrapper through injected and production factories.
- Module import, both factory constructions, controller/session creation,
  `getViewModel()`, start-over, and dispose remain free of time and capture.
  Only an accepted prepare calls time once and capture once in that order.
- Added 42/42 synthetic checks for canonical `.000Z` formatting, invalid time,
  typed success/incomplete/invalid failures, repeat/start-over/dispose behavior,
  raw-content privacy, and forbidden dependency boundaries. The combined
  retirement harness passes 735/735.
- The production prepare path was not invoked. No App/React/CSS wiring, real
  localStorage read, Writer data access, storage write, Drive/network call,
  backup/file creation, commit, push, deployment, or R3 behavior was added.
- c2b2b3 App placement review and c2b2b4 first real click remain separate
  approvals.

## 2026-08-13 - R2.6.3c2b2b2 production composition review (docs only)

- Added `WRITER_LEGACY_SPARK_PRODUCTION_COMPOSITION_REVIEW.md` without runtime,
  React/App/CSS changes, c2a invocation, localStorage read, real Writer data,
  storage writes, Drive/network, backup/file creation, commit, push, or deploy.
- Defined one future import-safe module that composes published c2b2a, c2b1,
  canonical timestamp creation, and c2a through injected and production
  controller factories.
- Time and c2a remain deferred until an accepted explicit prepare command.
  Import, factory/controller/session creation, `getViewModel()`, start-over,
  cancel, and dispose remain read-free.
- Defined canonical UTC-second timestamp behavior, typed failure mapping,
  three-key read ownership, raw-snapshot privacy, synthetic tests, and the
  unchanged c2b2b3/c2b2b4 gates.
- The smallest later implementation is c2b2b2 only. This docs phase does not
  implement it and does not authorize App wiring or the first real read.

## 2026-08-11 - R2.6.3c2b2b1 injected React panel (published)

- Added `LegacySparkRetirementLocalBackupPanel.tsx` as an isolated component
  over an injected c2b2a controller factory. It is not imported into `App.tsx`,
  `main.tsx`, or the product shell and has no CSS change.
- Controller creation remains lazy inside the accepted explicit command.
  Render, server render, mount, blocked commands, and release-only cleanup do
  not create the controller, call c2a, or read storage.
- Added text-free fail-closed blocking reasons, synchronous re-entry/repeat
  protection, safe static status copy, aggregate counts, start-over/cancel, and
  Strict Mode-safe idempotent release behavior.
- Added 45/45 synthetic panel checks; the combined Legacy Spark retirement
  harness now passes 693/693. No production c2a, App, storage, Drive, time,
  randomness, network, crypto, file, download, backup verification, or R3 path
  was added.
- Published at `340f8335ba1d1a68f9b180a66c946728addb9a7c`. The combined retirement
  harness passed 693/693; no real data was read and no App wiring was added.

## 2026-08-11 - R2.6.3c2b2b production React wiring review (docs only)

- Added `WRITER_LEGACY_SPARK_REACT_WIRING_REVIEW.md` without React/UI runtime,
  App/CSS changes, c2a invocation, localStorage read, Writer data access,
  Drive/network, hash, manifest, Blob/download, commit, push, or deployment.
- Split later work into c2b2b1 injected synthetic React panel, c2b2b2
  import-safe production composition, c2b2b3 separately reviewed App placement,
  and c2b2b4 separately approved first-real-click gate.
- Defined lazy controller ownership, a single explicit click sequence,
  fail-closed import/recovery/sync/editor guards, text-free React state,
  release-only unmount cleanup, synthetic checks, and the manual production
  gate. Render, mount, effects, imports, retries, and unrelated App actions
  remain read-free.
- At review time the smallest later implementation was c2b2b1 only. The newer
  local entry above records that isolated implementation; neither phase
  authorizes the first real c2a/localStorage read.

## 2026-07-30 - R2.6.3c2b2a headless minimal UI controller (published)

- Added a headless synthetic UI/controller slice over an injected c2b1 session
  factory. It has no React component, App import, production c2a wrapper import,
  real localStorage read, real Writer data, Drive/network call, Writer DB bytes,
  hash, manifest, Blob/download, backup verification, or R3 behavior.
- The controller exposes frozen text-free view models plus explicit
  `prepareLocalBackup()`, `startOver()`, and `dispose()` commands.
  `prepareLocalBackup()` is the only capture trigger; `startOver()` releases
  the old session and creates a new side-effect-free session without capture;
  `dispose()` releases the active session and leaves the controller released.
- Added synthetic c2b2a checks for creation/getViewModel side effects, one
  click, reentrancy/double-click safety, status and reason mapping, frozen
  public output, release lifecycle, and source boundaries.
- Published at `ae998764637075bf8bc341255903af23ce762232` with 44 focused checks
  and 648/648 combined retirement checks. The first real c2a/localStorage read
  still requires separate visible-chat approval after reviewed implementation,
  commit, push, deployment, and a clean worktree.

## 2026-07-30 - R2.6.3c2b2 minimal UI capture review (docs only)

- Added `WRITER_LEGACY_SPARK_MINIMAL_UI_CAPTURE_REVIEW.md` without React/UI
  runtime, App wiring, c2a invocation, localStorage read, Writer data access,
  Drive/network, hash, manifest, Blob/download, commit, push, or deploy.
- Inventoried the existing `App.tsx` Data area and CSS patterns. A future
  implementation belongs as one isolated retirement subsection after manual
  import/export controls and before Google Drive sync.
- Defined the future service/ref session boundary, text-free view model,
  explicit **Pripraviť lokálnu zálohu** gesture, first-real-read manual gate,
  session release rules, UI states, safe error mapping, synthetic tests, and
  c2b2/R2.6.3d boundary.
- This review opened the now-local R2.6.3c2b2a synthetic UI/controller slice
  with fake capture only. The first real c2a/localStorage read still requires a
  later explicit visible-chat approval after review, commit, push, and a clean
  worktree.
- Published at `b392600914a7a8e4eebe32644a97f99678e1bb41`.

## 2026-07-30 - R2.6.3c2b1 pure local capture session (published)

- Added `legacySparkRetirementLocalCaptureSession.ts` as a pure one-shot
  session coordinator over injected synthetic timestamp and capture dependencies.
- Reused only the published backup guide state machine:
  `START_PREREQUISITE_CHECK`, `PREREQUISITES_CONFIRMED`,
  `SNAPSHOT_CAPTURED`, `SNAPSHOT_INCOMPLETE`, and `SNAPSHOT_FAILED`.
- Kept the captured snapshot inside the session closure; public state exposes
  only guide state, safe createdAt, typed command reasons, counts, storage
  statuses, lifecycle flags, and next-step hints.
- Added 45 synthetic c2b1 checks for creation/getPublicState side effects,
  one-shot and reentrant prepare, timestamp failure, incomplete/invalid capture,
  release, frozen public state, and source boundaries.
- No App/UI wiring, c2a browser wrapper import, real localStorage read, real
  Writer data, storage write, Drive/network call, Writer DB bytes, Blob,
  download, backup verification, or R3 behavior was added.
- Published at `315b24b695113ff1dcc8c6f633428e483b100c02`. The docs-only c2b2
  minimal UI capture review is published at
  `b392600914a7a8e4eebe32644a97f99678e1bb41`.

## 2026-07-30 - R2.6.3c2b user-gesture capture review (docs only)

- Added `WRITER_LEGACY_SPARK_USER_GESTURE_CAPTURE_REVIEW.md` without runtime,
  UI, storage, Drive, or real-data changes.
- Inventoried the existing pure guide state machine and current UI: there is no
  retirement-guide wiring in `App.tsx`, and the product shell is read-only.
- Split c2b into c2b1, a pure injected one-shot session outside React, and
  c2b2, a later separately approved Writer Data-section integration.
- Defined click, concurrency, timestamp factory, guide transitions, internal
  snapshot/public state, release, privacy, retry, manual gate, tests, and the
  later c3d boundary. The first real read remains the future approved c2b2
  click.

## 2026-07-30 - R2.6.3c2a import-safe browser wrapper (published)

- Added an injected browser-storage acquisition helper and a thin public lazy
  wrapper above published c1. Neither module import nor function reference
  acquisition touches browser storage.
- Acquires one Storage-like object per explicit call, validates `getItem`, and
  reuses that object for c1's Spark -> Package -> Draft reads.
- Returns frozen text-free `LOCAL_STORAGE_UNAVAILABLE` before c1 for missing,
  invalid, or throwing acquisition; per-key failures remain owned by c1.
- Added 39 synthetic/nonbrowser checks; retirement is 559/559. The public
  wrapper was not invoked against real localStorage or Writer data.
- Added no App/UI wiring, user gesture, automatic invocation, storage write,
  clock, Drive/network, crypto, Blob/download, backup, c2b, c3d, or R3 behavior.
- Published at `58b99036878b9975c527373f66b82e248bee9408`. The next smallest
  implementation is pure synthetic c2b1; only later explicitly approved c2b2
  may perform the first real Writer-data read after the user click.

## 2026-07-30 - R2.6.3c2 browser boundary review (docs only)

- Published pure injected R2.6.3c1 at
  `9d8168e1237d16eea0cbd06de0d923142f7de8cf` after 44/44 c1 and 520/520 total
  retirement checks; Writer DB remained 284/284 and product shell 200/200.
- Split c2 into import-safe, unwired c2a and separately approved user-invoked
  c2b. Only c2b may perform the first real Writer localStorage read.
- Proposed one invocation-time `window.localStorage` acquisition, one retained
  Storage object, delegation to published c1, and text-free frozen
  `LOCAL_STORAGE_UNAVAILABLE` for acquisition failure.
- Prohibited import/render/effect/startup reads, automatic capture, storage
  writes/enumeration, implicit clocks, logs, analytics, clipboard, network,
  Drive, bytes, files, download, and raw author data in UI state.
- Defined synthetic c2a checks, the separately authorized c2b manual checklist,
  reference release on completion/`START_OVER`, and a separate R2.6.3d
  post-Drive exact raw consistency boundary.
- No browser wrapper, UI, real storage/data read, backup artifact, staging,
  commit, push, or deployment is part of this docs-only slice.

## 2026-07-30 - R2.6.3c1 pure injected local capture (published)

- Added a pure coordinator with one injected `readStorageValue` dependency and
  the three reviewed keys owned inside the retirement module.
- Reads Spark -> Package -> Draft exactly once each before delegating all raw
  interpretation and canonical `createdAt` validation to published R2.6.3a.
- Maps `null` to missing and every string unchanged to present. Separate typed
  read failures stop immediately, return no partial snapshot or exception text,
  and freeze both wrapper and reasons.
- Added 44 synthetic checks; the retirement harness is 520/520. Published at
  `9d8168e1237d16eea0cbd06de0d923142f7de8cf` without browser storage, real
  author data, bytes, crypto, Drive, network, file/download, UI, storage write,
  tombstone, R3, or deployment.
- The next step is split into import-safe c2a and separately approved c2b. Only
  user-invoked c2b may first call real `window.localStorage.getItem`.

## 2026-07-30 - R2.6.3c localStorage reader review (docs only)

- Published R2.6.3b at `389b6347ec84d5472aa62a86d11fdff3416fed6d`
  after 476/476 retirement, 284/284 Writer DB, and 200/200 product-shell checks.
- Inventoried the exact Spark, Package, and draft keys and documented why the
  product loaders cannot preserve raw failure states.
- Fixed the synchronous read order to Spark -> Package -> Draft, exactly once
  each, with explicit missing states and typed text-free read failures.
- Kept `createdAt` explicit and routed success through R2.6.3a and optional
  R2.6.3b without duplicating parsing or byte construction.
- Split future work into c1 pure injected synthetic coordinator and c2 thin
  browser wrapper. Only c2 is allowed to perform the first real storage read.
- Kept R2.6.3d as a separate post-Drive consistency check and prohibited
  writes, logs, network, Drive, files, downloads, caching, and long-lived raw
  author-data references.
- No runtime implementation, localStorage read, real-data use, backup artifact,
  staging, commit, push, or deployment is part of this docs-only slice.

## 2026-07-30 - R2.6.3b exact Writer DB v2 bytes builder (local only)

- Added a pure builder that accepts only a successful R2.6.3a snapshot and an
  injected UTF-8 encoder.
- Reused `createWriterDbV2Payload`, preserved snapshot collection order,
  tombstones, notes/deleted notes, timestamps, and legacy metadata, serialized
  exactly with `JSON.stringify(payload, null, 2)`, and self-verified through
  the published R2.2 structure verifier.
- Copied dependency bytes immediately into a closure-owned buffer. The public
  artifact exposes only frozen text-free metadata and
  `copyWriterDbV2Bytes()`, which returns a fresh copy on every call.
- Added 50 synthetic R2.6.3b checks while preserving all prior 426 checks; the
  retirement harness is 476/476.
- No localStorage, real data, direct TextEncoder, hashing, Drive, network,
  Blob/download, UI, manifest, file, write, R3, commit, push, or deployment is
  part of this local slice. R2.6.3c thin read-only `localStorage.getItem`
  adapter is the next separately reviewed step.

## 2026-07-30 - R2.6.3a pure raw local snapshot model

- Added a pure parser/model that accepts only explicit synthetic raw Spark,
  Package, and draft storage values plus an injected canonical `createdAt`.
- Reused the existing Writer DB Spark parser and WriterPackage validator;
  invalid JSON, wrong top-level types, invalid records, and duplicate IDs block
  the complete collection without filtering, repair, adaptation, or migration.
- Preserved missing versus stored `[]`, collection order, Spark and Package
  tombstones, notes, deleted notes, exact raw strings, and deeply frozen
  detached in-memory records. Public summary metadata is text-free with sorted
  IDs and counts only.
- A valid non-empty draft returns text-free `incomplete` with `DRAFT_PRESENT`;
  malformed or invalid draft storage is `invalid`. Draft text is never returned
  in reasons or summary and is not part of Writer DB data.
- Added 61 synthetic R2.6.3a checks while preserving all earlier 365 checks;
  the retirement harness is 426/426.
- No localStorage, browser global, encoder, crypto, Drive, network, React,
  Writer DB bytes, Blob/download, file, real data, write, R3, or deployment is
  part of this slice. Published at
  `fc741821a49a957b85d1f3fc9a0c4d72d6f9faa3`. R2.6.3b exact Writer DB v2 bytes over
  this captured snapshot is the next separately reviewed step.

## 2026-07-30 - R2.6.3 local snapshot review (docs only)

- Added `WRITER_LEGACY_SPARK_LOCAL_SNAPSHOT_REVIEW.md` as a docs-only contract
  for the future read-only local snapshot adapter.
- Inventoried Spark, Package, and new-Spark-draft storage keys and documented
  why the current product loaders are not raw-backup-safe: they filter invalid
  records, hide tombstones in UI paths, adapt Sparks into catalog Packages, or
  perform separate runtime reads.
- Defined one synchronous raw local snapshot, missing/empty/corrupt rules,
  Writer DB v2 exact-byte creation, draft blocking, typed reason codes, privacy
  rules, synthetic tests, and R2.6.3a-R2.6.3d implementation slices.
- No runtime, UI, CSS, storage read, Drive call, backup/download, real data, or
  deployment is part of this docs-only review. Published at
  `a273353ef784f8343a176e8057b59ba4526f259f`. The
  next smallest implementation step is R2.6.3a pure raw storage parser and
  snapshot model over synthetic strings.

## 2026-07-30 - R2.6.2 strict browser adapters

- Added local-only browser adapters for R2.5-compatible UTF-8 and SHA-256
  dependencies in `src/legacySparkRetirementBrowserAdapters.ts`.
- Encoding uses `TextEncoder` without trim, Unicode normalization, or newline
  changes. Strict decoding uses `TextDecoder("utf-8", { fatal: true,
  ignoreBOM: false })`, so invalid UTF-8 is rejected and a UTF-8 BOM is
  consumed only for the decoded text while raw hashing still covers the
  original BOM bytes.
- SHA-256 uses only `globalThis.crypto.subtle.digest("SHA-256", copiedBytes)`.
  The adapter copies bytes before async digest, returns 64-character lowercase
  hex, and reports only safe internal error codes for missing crypto or digest
  failure.
- Added 37 synthetic R2.6.2 checks for UTF-8, BOM, hash vectors, mutable byte
  snapshots, canonical text hashing, R2.5 signature compatibility, frozen
  bundle output, privacy, and side-effect boundaries. The retirement harness is
  now 365/365.
- Verified locally with `check:legacy-spark-retirement` 365/365,
  `check:writer-db` 284/284, and `check:product-shell` 200/200. The sandbox
  build still hits the known Vite/esbuild `spawn EPERM`; the unchanged build
  passes outside the sandbox, including with empty `VITE_GOOGLE_CLIENT_ID`.
- No Node crypto, Buffer, dependency, React, UI, CSS, storage, Drive, Blob,
  File/download, filesystem, real data, backup artifact, tombstone, reset, R3,
  or deployment is part of this slice. The next separate step is R2.6.3
  docs-only local read-only snapshot review.

## 2026-07-29 - R2.6.1 pure backup guide state model

- Added a pure deterministic backup-guide state model with the approved R2.6
  statuses from `idle` through `backup-verified`, plus `incomplete` and
  `invalid`.
- Added typed events, allowed transition checks, `transitioned`/`rejected`
  results, rejected transition reason codes, safe text-free metadata, and
  immutable transition results.
- Required `backup-verified` to come only from `downloaded-files-reselected`
  after an explicit future re-verification event confirms raw hash match,
  Writer DB structure verification, Drive verification or `not-applicable`,
  manifest cross-check, and Package baseline match.
- Added 42 synthetic R2.6.1 checks and connected them to the existing retirement
  harness. The retirement harness is now 328/328 with all 286 prior R1-R2.5
  checks retained.
- No React, UI, CSS, storage, Drive, crypto, filesystem, Blob/download, File
  API, real data, backup artifact, tombstone, reset, R3, or deployment is part
  of this slice. The next separate step is R2.6.2 strict UTF-8 and browser Web
  Crypto adapters.

## 2026-07-29 - R2.6 backup guide and adapter review (docs only)

- Added `WRITER_LEGACY_SPARK_BACKUP_GUIDE_REVIEW.md` to define the future
  temporary Data backup guide without implementing runtime behavior.
- Documented the published R2.5 boundary at
  `ffd7090bf0d5a911d0a074ce1d764dd4ab0e8a28`: success reaches only
  `assembly-verified` and permits only `present-backup-download`, not R3.
- Reviewed current Spark, WriterPackage, Writer DB v2 export, App Data, product
  shell, and Google Drive sync boundaries. The current Drive sync path parses,
  merges, creates, and uploads, so it is forbidden for raw backup reading.
- Specified future production adapters for one captured local snapshot, raw
  Drive v1 GET-only bytes, current WriterPackages, raw Package storage bytes,
  strict UTF-8, and browser Web Crypto SHA-256.
- Defined the download/reselect boundary, manifest cross-check,
  `backup-verified` status machine, auth/Drive errors, privacy rules, R2.6.1
  through R2.6.8 phases, synthetic tests, and manual verification plan.
- No TypeScript, App, CSS, runtime adapter, localStorage read, Google Drive
  call, Blob/download, backup file, real data hash, stage, commit, push, or
  deployment is part of this docs-only step.

## 2026-07-28 - R2.5 dependency-injected backup assembly (local only)

- Added an asynchronous coordinator over synthetic `Uint8Array` Writer DB v2
  and Drive v1 artifacts, current WriterPackages, optional raw Package storage
  bytes, strict UTF-8 decoding, and injected byte/canonical SHA-256 functions.
- Copied every supplied byte array before processing, decoded a separate copy,
  structurally verified through R2.2/R2.3, and hashed the exact snapshot bytes
  without parse/stringify normalization.
- Compared independently built current and backup R2.4 Package baselines,
  including counts, tombstones, notes, deleted notes, sorted IDs, and semantic
  hash. Any difference returns `PACKAGE_BASELINE_MISMATCH`.
- Returned only a deeply frozen text-free manifest and
  `assembly-verified`/`incomplete`/`invalid`; success allows only
  `present-backup-download` and is not `backup-verified` or R3 permission.
- Added 55 synthetic R2.5 checks for exact bytes, async failures, baseline
  mismatch, privacy, immutability, and isolation. The retirement harness is
  286/286 with all 231 earlier R1-R2.4 checks retained.
- No production storage, Drive, export, Web Crypto, download, Blob, UI, file,
  real user data, write, sync, tombstone, reset, commit, push, or deployment is
  part of R2.5. The next separate step is R2.6 review of a temporary read-only
  backup guide and explicit production adapters.

## 2026-07-28 - R2.4 pure WriterPackage baseline

- Added an asynchronous pure baseline builder for explicitly supplied
  WriterPackages and an injected SHA-256 hasher that may return either a string
  or a Promise; no crypto or storage implementation is imported.
- Reused the existing Package validator, rejected duplicate IDs, unknown
  runtime fields, and explicitly present `undefined` optional fields.
- Canonicalized all Package text layers, timestamps, tombstones,
  `packageVersion`, notes/deleted notes, and legacy metadata in fixed field
  order. Top-level Packages are sorted by code-unit ID; note order is preserved.
- Returned only frozen text-free counts, sorted Package IDs, semantic hash, and
  an optional separately supplied validated raw-storage hash. Success is
  `baseline-built`, not `backup-verified`.
- Added 70 synthetic R2.4 checks, including synchronous, Promise-based,
  rejected, and invalid async hashers, while preserving R2.3 42/42, R2.2
  43/43, R2.1 48/48, and R1 28/28, for 231/231 retirement checks.
- No real user data, storage/Drive access, file creation, UI, sync, merge,
  write, tombstone, reset, or deployment is part of R2.4.
- Published as `5ae5cbaa4ad044b9ebd62bf15d8d5bff50ba4ed1`.
- The next smallest step is separately reviewed R2.5 read-only assembly.

## 2026-07-28 - R2.3 pure Drive v1 backup verifier

- Added a pure verifier for explicit `present`, `not-applicable`, and
  `required-but-missing` Drive source states without calling Drive or sync.
- Reused the existing read-only Writer DB v1 parser for app/schema, Spark, stage,
  timestamp, tombstone, tag, and record validation; required strict declared
  count equality and unique Spark IDs without merge or deduplication.
- Emitted only frozen text-free metadata: schema, validated `exportedAt`, total,
  live/tombstone counts, and deterministically sorted Spark IDs.
- Kept `structure-verified` explicitly below raw-hash, byte-exact, and overall
  `backup-verified`; no SHA-256 is calculated and raw JSON is not reproduced.
- Added 42 synthetic R2.3 checks while preserving R2.2 43/43, R2.1 48/48, and
  R1 28/28, for 161/161 retirement checks in the combined harness.
- No Google Drive API, sync, fetch, upload, merge, storage, filesystem, hash,
  backup file, UI, write, tombstone API, or real-data access was added.
- Published as `a1c16610a7d404d401a28295bc161c40d6168a6d`. The next smallest
  step is R2.4, the Package baseline and semantic fingerprint contract.

## 2026-07-28 - R2.2 pure Writer DB v2 backup verifier

- Added a pure verifier for one explicitly supplied raw Writer DB v2 JSON
  string, reusing the existing read-only parser and record validators.
- Required the exact app and v2 schema, valid declared counts, strict count-to-
  array equality, valid Sparks/Packages/notes/timestamps, and unique IDs within
  each collection. No merge, deduplication, repair, or timestamp rewrite occurs.
- Preserved tombstones and deleted notes in frozen text-free summary counts and
  emitted deterministic sorted Spark and Package IDs without creative text.
- Used `structure-verified` for artifact-level success so it cannot be confused
  with overall R2 `backup-verified`; invalid results contain only frozen typed
  reason codes.
- Added 43 synthetic R2.2 checks while preserving R2.1 48/48 and R1 28/28, for
  119/119 retirement checks in the combined harness.
- No hash, filename, manifest, backup file, storage, Drive, network, UI,
  tombstone API, import, write, or real-data access was added.
- Published as `625472dd02b75152162bb3d6e573f4f586d335d6`. The next
  smallest step is R2.3, a pure raw Drive v1 backup verifier.

## 2026-07-28 - R2.1 pure Legacy Spark backup plan

- Added pure backup artifact, stable filename, text-free manifest-plan, typed
  reason-code, safe metadata input, and discriminated build-result types.
- Added deterministic filename generation from an explicit canonical UTC
  `.000Z` timestamp; no current-time fallback or silent timestamp repair exists.
- Added count, tombstone, note, duplicate Package ID, schema, and Drive metadata
  validation with deterministic Package ID ordering.
- Deep-froze the plan, artifacts, manifest, nested metadata, and detached
  Package ID array. The highest state is `planned`; the only next step is
  `verify-backup`.
- Added 48 synthetic R2.1 checks while preserving all 28 R1 checks, for 76/76
  retirement checks in the combined harness.
- No hash was calculated and no real backup file, author data, storage, Drive,
  network, UI, tombstone, reset, or runtime path was read or changed.
- Published as `40c56c85874b74fe6ce503ba3f2a8fc2c47f36be`. The next
  smallest step is R2.2, a pure Writer DB v2 backup verifier over synthetic
  inputs.

## 2026-07-25 - R2 Legacy Spark backup contract review (docs only)

- Audited the current Writer DB v2 export, parser/preview, import backup,
  persistence/recovery, Spark storage, WriterPackage storage, production export,
  and v1 Google Drive sync boundaries without changing runtime code.
- Defined three future R2 artifacts: a validated v2 backup, an exact raw-byte
  Drive v1 copy or proven not-applicable result, and a text-free verification
  manifest with raw SHA-256 hashes and deterministic semantic fingerprints.
- Defined strict count and duplicate checks, the immutable WriterPackage
  baseline, typed `backup-verified`/`incomplete`/`invalid` outcomes, a declared
  device/profile checklist, and independently reviewable R2.1-R2.7 gates.
- Recorded that normal newest-wins import is not a reliable post-tombstone undo;
  the recommended future rollback is a separately reviewed exact Spark-only
  restore while sync is paused, with WriterPackages preserved and reverified.
- Created no backup file, read no real author data, and added no runtime, CSS,
  storage, Drive, deletion, tombstone, staging, commit, push, or deployment
  change. R2 remains unimplemented.

## 2026-07-25 - R1 pure Legacy Spark retirement inventory

- Added a pure inventory kernel over supplied typed Spark sources, real
  WriterPackages, Drive v1 export shape, and Writer DB v2 backup shape.
- Added deterministic union IDs, latest observed timestamps, per-source
  live/tombstone counts, Package count, draft presence, duplicate blocking, and
  a conservative resurrection-risk flag without exposing author text.
- Froze the complete result and limited its only preview status to
  `ready-for-backup`; no delete-ready, purge-ready, or completed state exists.
- Added a separate `check:legacy-spark-retirement` harness with 28 artificial
  checks. The original Writer DB runner remains unchanged at 284 checks.
- Added no React, UI, loader, browser storage, current time, randomness,
  network, Google Drive request, backup, tombstone construction, reset, write,
  migration, or new storage key. R2 remains unimplemented.

## 2026-07-24 - Legacy Spark retirement review (docs only)

- Inventoried the current Spark, WriterPackage, draft, Writer DB v2,
  persistence/recovery, App, and v1 Google Drive behavior without changing it.
- Documented why local clear, one-device tombstones, an empty Drive file, or an
  early hard purge can resurrect legacy data under newest-wins merge rules.
- Defined the conservative R1-R7 sequence: read-only inventory, verified local
  and Drive backups, local tombstones, device/profile convergence, observation,
  optional purge, and a separately reviewed package-only product cutover.
- Chose a temporary Data wizard as the eventual reset surface, with preview,
  explicit backup evidence, typed confirmation, and no logging of author text.
- Added no runtime, CSS, storage, Google Drive, import/export, migration,
  deletion, staging, commit, push, or deployment change.

## 2026-07-24 - Phase B5 read-only detail published

- Published B5.4 together with the final synthetic integration and isolation
  review at `f268d569a1c45214090dcac326633afab76c6968`.
- Phase B5 is closed. The isolated exact-DEV detail remains read-only, uses the
  one immutable startup snapshot, and performs no second load or write.

## 2026-07-24 - Phase B5.4 read-only detail UI (local only)

- Connected the published B5.3 selection model to the isolated exact DEV
  `real-read-only` Library using local React state and the already-loaded B5.2
  snapshot only.
- Enabled `Pokračovať` and Library cards to open static detail, added the four
  layer buttons, PC context/active panels, mobile active-only layout, return to
  Knižnica, truthful empty states, legacy origin label, and safe missing-detail
  copy.
- Added no editor, input, save, autosave, second loader, storage read/write,
  persistence, production entry, or Google Drive behavior. `Nová iskra` remains
  disabled and fixture mode remains unchanged.
- Added 17 artificial detail-presentation checks and 9 new static isolation
  checks. The product-shell harness now passes 200/200 while all earlier 174
  checks remain present.
- Local only: not staged, committed, pushed, or deployed. B5.5 synthetic
  integration and final isolation review is the next separate gate.

## 2026-07-24 - Phase B5.3 pure read-only selection model

- Added a pure immutable state for one optional `selectedPackageId` and one of
  the four detail layers, initially `null / spark`.
- Added frozen select, layer, and return transitions. Selecting a work resets
  the layer to `spark`; returning clears the ID and also resets to `spark`.
- Added a pure resolver over the existing B5.2 `detailsById`. It returns
  `library`, `detail`, or `missing-detail`, uses an own-property lookup, safely
  supports `__proto__`, and reuses the original frozen detail reference.
- Added 26 artificial behavior checks and 5 static isolation checks, bringing
  the complete product-shell harness from 143/143 to 174/174.
- No loader, provider, storage, persistence, React, UI, CSS, time, randomness,
  logging, network, or Google Drive behavior was added. Selection is not
  persisted and missing-detail triggers no new load.
- Published at `22973efd5c0b6a49f51d0a954073ffb603b31345`. Its pure model
  remains unchanged by the local B5.4 UI.

## 2026-07-24 - Phase B5.2 immutable read-only Library snapshot

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
- Published at `8ec9fe3431ee71aab78085cca07661dc25c31633`. Its snapshot
  and provider contracts remain unchanged by B5.3.

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
