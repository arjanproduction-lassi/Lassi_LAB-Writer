# Writer Legacy Spark Production Composition Review

Status: R2.6.3c2b2b2 contract originally reviewed as docs-only and published at
`959a4c756d6f901cd45501b6286dd1374091e2ce`. c2b2b1 is published as an
isolated React panel with a synthetic controller factory and no App wiring.
The matching c2b2b2 runtime composition and synthetic checks implement this
reviewed contract. They change no React or App file, do not execute c2a
or read localStorage/Writer data during checks, and create no backup, hash,
manifest, Blob, file, download, or deployment.

## Decision

The c2b2b2 implementation adds exactly one thin production composition
module. It connects four already published layers without
changing their contracts:

1. c2b2a `createLegacySparkRetirementMinimalUiCaptureController()`;
2. c2b1 `createLegacySparkRetirementLocalCaptureSession()`;
3. a tiny canonical timestamp adapter;
4. c2a `captureLegacySparkRetirementBrowserLocalStorageSnapshot()`.

The module exports a controller factory compatible with the existing c2b2b1
panel prop. It is not imported into `App.tsx` during c2b2b2. Module import,
factory reference, factory creation, controller creation, `getViewModel()`,
start-over, cancel, and dispose must remain free of time access and browser
storage access.

Only the later accepted panel command may reach c2b1
`prepareLocalSnapshot()`. Inside that command, c2b1 first requests one
canonical timestamp and then calls c2a exactly once with that same timestamp.

## Current Published Inputs

The composition must reuse, not redesign, these APIs:

- c2a accepts `{ createdAt }`, lazily acquires `window.localStorage`, and
  delegates only three fixed `getItem` reads to the pure local snapshot layer;
- c2b1 accepts `createCanonicalTimestamp` and `captureLocalSnapshot`
  dependencies and invokes them only from its one-shot prepare command;
- c2b1 retains the captured raw snapshot in its own closure and exposes only a
  text-free public state;
- c2b2a accepts a `createSession` dependency, creates a session without
  capture, and exposes a frozen text-free controller;
- c2b2b1 accepts `createController`, stores only an interaction wrapper during
  render, and first calls the controller factory from an accepted explicit
  command.

The production composition module connects these APIs, but it is not imported by
the panel or App. Therefore no real retirement localStorage read is currently
reachable from the UI.

## Module Boundary

Implemented file:

`src/legacySparkRetirementLocalBackupRuntime.ts`

Its complete responsibility is:

- convert one injected current-time value into a canonical UTC-second string;
- create c2b1 sessions with timestamp and capture dependencies;
- create c2b2a controllers with that session factory;
- expose one production controller factory for later injection into c2b2b1.

It must not contain React, JSX, UI text, App state, storage keys, direct
`window.localStorage`, Writer DB import/recovery logic, Google sync logic,
Drive calls, backup assembly, hashing, file creation, download, R3, or logging.

## Proposed Public API

The implementation keeps production effects replaceable in tests:

```ts
type LegacySparkRetirementLocalBackupRuntimeDependencies = Readonly<{
  getCurrentTimeMilliseconds: () => number;
  captureLocalSnapshot: (
    input: Readonly<{ createdAt: string }>
  ) => LegacySparkRetirementLocalSnapshotResult;
}>;

createLegacySparkRetirementLocalBackupControllerWithDependencies(
  dependencies
): LegacySparkRetirementMinimalUiCaptureController

createLegacySparkRetirementLocalBackupController(
): LegacySparkRetirementMinimalUiCaptureController
```

The injected function is the primary test surface. The zero-argument
production wrapper supplies only:

- `getCurrentTimeMilliseconds: () => Date.now()`;
- `captureLocalSnapshot:
  captureLegacySparkRetirementBrowserLocalStorageSnapshot`.

The production wrapper itself must not run either dependency. It only creates
the dependency closures and passes them down.

Naming may be adjusted during implementation for consistency, but the two-level
injected/production split and behavior must remain unchanged.

## Canonical Timestamp Contract

c2b1 and the backup contracts require exactly:

`YYYY-MM-DDTHH:mm:ss.000Z`

The injected time dependency should return epoch milliseconds rather than a
mutable `Date` object or a preformatted string. The runtime adapter should:

1. call `getCurrentTimeMilliseconds()` exactly once per accepted prepare;
2. reject non-finite values;
3. floor the value to a whole UTC second;
4. create a new `Date` from the floored milliseconds;
5. call `toISOString()`;
6. verify that the result ends with canonical `.000Z` precision;
7. return the string unchanged to c2b1.

No current-time fallback, silent repair, locale formatting, timezone offset,
randomness, or storage-derived time is allowed. Negative valid epoch values
need not be specially supported beyond normal JavaScript `Date` behavior; an
out-of-range or otherwise invalid value must throw. c2b1 already catches
timestamp dependency failure and maps it to safe
`CREATED_AT_CREATION_FAILED` public state.

The timestamp is attempt metadata, not a transaction ID. c2b2b2 creates no
identifier and contains no user text or sensitive data.

## Import-Safety Sequence

These operations must all produce zero time calls and zero capture/storage
calls:

1. import the composition module;
2. obtain the exported production factory reference;
3. invoke the injected factory with synthetic dependencies;
4. invoke the production factory to create a controller;
5. create the c2b1 session inside the controller;
6. call controller `getViewModel()`;
7. render or mount c2b2b1 with the factory;
8. block a panel command before factory invocation;
9. call `startOver()` before or after a completed attempt;
10. cancel or dispose the panel/controller.

Controller/session construction is allowed because those published
constructors are side-effect-free. Neither constructor may be changed in this
phase.

## Accepted Command Sequence

After later c2b2b3 App wiring and a later c2b2b4 approval, exactly one accepted
**Pripraviť lokálnu zálohu** command may execute:

1. c2b2b1 rejects external guards and re-entry before factory work;
2. c2b2b1 lazily calls the production controller factory once;
3. c2b2a issues one c2b1 prepare command;
4. c2b1 calls the canonical timestamp dependency once;
5. c2b1 passes the resulting string to `captureLocalSnapshot` once;
6. the production capture dependency calls c2a once;
7. c2a acquires localStorage lazily and reads only the three approved keys;
8. typed snapshot/incomplete/invalid state returns through c2b1 and c2b2a;
9. c2b2b1 receives only the frozen text-free view model;
10. execution stops.

If timestamp creation fails, c2a is not called. If c2a returns unavailable,
read-failed, incomplete, or invalid, no retry or fallback storage path runs.
Exceptions must not expose their text to UI or logs.

## Storage Boundary

The composition module defines no key. c2a and its pure dependency remain the
only owners of these existing reads:

- `lassilab-writer:v0.1:sparks`;
- `lassilab-writer:v0.1:packages`;
- `lassilab-writer:v0.1:draft:new-spark`.

The composition module must not import key constants merely to duplicate or
inspect them. It must not use `window`, localStorage, sessionStorage,
`getItem`, `setItem`, `removeItem`, or `clear` directly.

c2a remains read-only. No storage write, mutation, migration, tombstone, reset,
purge, transaction marker, or new storage key is introduced.

## Raw Snapshot Ownership

c2b1 continues to own the raw captured snapshot in its private closure.
c2b2b2 must not:

- return the raw snapshot from the controller factory;
- add snapshot access to c2b2a or c2b2b1 public state;
- place the snapshot in React state, props, context, reducers, events, logs, or
  error messages;
- serialize, hash, copy to clipboard, persist, upload, or download it.

The existing c2b1 `withCapturedSnapshotForInternalUse()` capability is not
reachable through c2b2a. c2b2b2 must not widen the controller API to solve that
future orchestration problem. Connecting the captured snapshot to Drive/backup
assembly requires a separately designed internal orchestration boundary after
the first local capture path is proven.

## Error Mapping

The composition layer should not invent a new public error vocabulary.

- time dependency throws or produces invalid time -> c2b1
  `CREATED_AT_CREATION_FAILED`;
- capture dependency unexpectedly throws -> c2b1
  `CAPTURE_DEPENDENCY_FAILED`;
- unavailable browser storage -> existing c2a
  `LOCAL_STORAGE_UNAVAILABLE` result;
- individual key read failures -> existing typed c2a/local snapshot reasons;
- invalid/draft-present data -> existing typed local snapshot reasons;
- controller/UI re-entry or lifecycle rejection -> existing c2b2a/c2b2b1 safe
  message keys.

No raw exception message, stack trace, storage value, ID, title, excerpt, note,
or author text may enter public results.

## Synthetic Verification Plan

The c2b2b2 checks use only injected dependencies and synthetic data. They
prove:

- module import has no time, window, storage, capture, or network side effect;
- injected factory creation creates one controller/session but calls neither
  injected dependency;
- production factory creation also calls neither `Date.now()` nor c2a;
- `getViewModel()`, start-over, cancel, and dispose remain read-free;
- one prepare calls time once and capture once in that order;
- capture receives exactly the canonical timestamp created for that attempt;
- fractional milliseconds are floored to `.000Z`;
- non-finite and out-of-range time values safely prevent capture;
- timestamp dependency throw prevents capture and maps safely;
- capture dependency throw maps safely and exposes no exception text;
- successful/incomplete/invalid results preserve existing typed mapping;
- second prepare without start-over causes no new time or capture call;
- start-over creates a fresh side-effect-free session, and only a later
  explicit prepare causes another time/capture pair;
- disposing releases the session and later prepare creates no effects;
- public controller/view-model JSON contains no synthetic author text, IDs,
  raw strings, session object, dependency callbacks, bytes, or errors;
- source contains no React, App, direct storage, Drive/network, crypto, Blob,
  FileReader, object URL, download, backup assembly, verification, or R3 path;
- c2b2b1 45 checks and the full retirement harness remain preserved.

Production-wrapper source checks should verify that the only effectful
adapters are the deferred `Date.now()` callback and the published c2a function.
Automated checks must never invoke the zero-argument production factory's
prepare command against a real browser profile.

## App And Activation Boundary

c2b2b2 does not import the panel into App and does not make the operation
visible. `App.tsx`, `main.tsx`, CSS, product shell, routes, import/export,
storage, recovery, persistence, WriterPackage storage, and Google Drive sync
must have zero diff.

Publishing a safe composition module still does not authorize:

- c2b2b3 App placement;
- deriving App blocking props;
- an active production button;
- c2b2b4 first real click;
- any localStorage read during tests, build, render, or deployment.

## Manual First-Read Gate

The manual gate remains unchanged. The first real c2a/localStorage read may
happen only after:

- c2b2b2 is separately implemented, reviewed, committed, and published;
- c2b2b3 App placement is separately reviewed, committed, published, and
  deployed;
- the intended production origin, browser profile, and device are confirmed;
- Writer DB recovery is clean and import, editor/draft, and Google sync are
  idle;
- the worktree is clean and deployed commit hashes are known;
- explicit visible-chat approval is given immediately before the click.

No docs review, module import, commit, push, build, deployment, render, or mount
counts as that approval.

## Implementation Result

The implementation adds only
`src/legacySparkRetirementLocalBackupRuntime.ts`, its synthetic checks, and the
existing retirement-harness import/count wiring. It exposes the injected and
zero-argument production controller factories defined above. Its 42/42 checks
prove that imports, factory/controller/session creation, `getViewModel()`,
start-over, and dispose are read-free; one injected accepted prepare performs
one canonical timestamp call followed by one synthetic capture call. The
combined retirement harness passes 735/735.

The production prepare path is not invoked by automated checks. The module is
not imported into `App.tsx`, the panel remains invisible, and no real browser
storage read has occurred.

## Out Of Scope

This c2b2b2 slice does not implement or authorize:

- React, App, CSS, navigation, route, or production button changes;
- any real localStorage or Writer data read;
- Writer DB bytes, Drive raw GET, sync changes, hashing, assembly,
  verification, manifest, Blob, file, or download;
- raw snapshot orchestration beyond c2b1;
- R2.6.3d post-Drive consistency reread;
- tombstones, reset, purge, migration, merge, R3, or package-only cutover;
- deployment or user-data deletion.

## Go / No-Go For c2b2b3 Review

Proceed to c2b2b3 review only if the implementation remains one small non-React
module plus synthetic checks and harness wiring. Stop if it requires changing c2a, c2b1,
c2b2a, c2b2b1, App, CSS, storage keys, import/export, recovery, persistence, or
Google sync.

The implementation is complete only when import/factory/controller creation is
proven effect-free and exactly one explicit prepare maps to one timestamp and
one c2a call under synthetic dependencies.

## Smallest Safe Next Step

The docs-only c2b2b3 contract is now defined in
`WRITER_LEGACY_SPARK_APP_PLACEMENT_REVIEW.md`. Its smallest later
implementation is one pure guard helper and one narrow App placement. Do not
begin that implementation without explicit approval. c2b2b4 first real click
remains a later separate approval.
