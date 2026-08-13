# Writer Legacy Spark User-Gesture Capture Review

R2.6.3c2b began as a docs-only review of the first explicitly user-invoked
local snapshot boundary. R2.6.3c2b1 is published as the pure session
coordinator. The follow-up c2b2 minimal UI capture review is published at
`b392600914a7a8e4eebe32644a97f99678e1bb41`. R2.6.3c2b2a is published at
`ae998764637075bf8bc341255903af23ce762232` as a headless synthetic UI
controller. The docs-only c2b2b React wiring review is defined in
`WRITER_LEGACY_SPARK_REACT_WIRING_REVIEW.md`. This review still does not wire
published c2a into App, reads no browser storage or real Writer data, and
creates no backup, hash, manifest, Blob, download, commit, push, or deployment.

## Existing Guide And UI Inventory

The repository already contains a pure retirement guide state machine in
`src/legacySparkRetirementBackupGuideState.ts`. It defines the complete status
sequence from `idle` through `backup-verified`, including:

- `idle` + `START_PREREQUISITE_CHECK` -> `checking-prerequisites`;
- `checking-prerequisites` + `PREREQUISITES_CONFIRMED` ->
  `snapshot-capturing`;
- `snapshot-capturing` + `SNAPSHOT_CAPTURED` -> `drive-reading`;
- `snapshot-capturing` + `SNAPSHOT_INCOMPLETE` -> `incomplete`;
- `snapshot-capturing` + `SNAPSHOT_FAILED` -> `invalid`;
- any status + `START_OVER` -> a new `idle` state.

The guide model filters metadata to text-free timestamps, counts, key/Drive
statuses, short hashes, filenames, reason codes, and approved next-step data.
It does not carry raw snapshots. Today it is imported only by its synthetic
checks and the retirement harness. There is no retirement backup-guide runtime
coordinator, React state, button, or UI in App or Product shell.

The current Writer `App.tsx` has an operational **Dáta / Ručný prenos DB**
section for manual export/import actions. It is the least surprising future
home for a separately labelled retirement-backup subsection, but it must not be
mixed into the existing export/import handlers. The Product shell is a
read-only Library prototype and can optionally assemble catalog data; it is not
the correct owner for the first sensitive operational capture.

Decision: keep c2b1 outside React. If c2b2 is later approved, add a minimal
isolated subsection to the old Writer **Dáta** area, not Product shell, and do
not modify existing import/export behavior.

## Split c2b1 From c2b2

- **R2.6.3c2b1 — pure one-shot session coordinator.** It accepts injected
  timestamp and capture dependencies and uses the published guide state machine.
  Synthetic tests only; no `window`, localStorage, React, real clock, Drive,
  Blob, or download.
- **R2.6.3c2b2 — minimal user-gesture wiring.** A later separate approval may
  add one clear button and connect one click to c2b1. Only an actual click on
  that wired button may become the first authorized real Writer-data read.

Creating/importing c2b1, rendering c2b2, mounting it, or entering the Data
section must never call capture.

## User-Gesture Boundary

Working label: **Pripraviť lokálnu zálohu**. Supporting copy must say that the
check is local and read-only and does not yet download anything.

Before the click:

- c2a has not been called;
- no retirement localStorage read or snapshot exists;
- no Writer DB bytes, Drive call, network request, or download exists.

After the click, the future c2b2 handler may issue exactly one c2b1 command.
c2b1 owns the pure one-shot guide progression for that command: create the
published idle guide state, transition through `START_PREREQUISITE_CHECK` and
`PREREQUISITES_CONFIRMED`, and reach `snapshot-capturing` before capture. c2b1
must not invent a second prerequisite or guide-state model. Only after those
published transitions succeed may it create one timestamp and call its injected
capture dependency once.

This review neither creates nor invokes that handler.

## Proposed c2b1 Session API

```ts
type LegacySparkRetirementLocalCaptureSessionDependencies = Readonly<{
  createCanonicalTimestamp(): string;
  captureLocalSnapshot(input: Readonly<{ createdAt: string }> ):
    LegacySparkRetirementLocalSnapshotResult;
}>;

createLegacySparkRetirementLocalCaptureSession(dependencies): Readonly<{
  prepareLocalSnapshot(): LegacySparkRetirementLocalCaptureCommandResult;
  getPublicState(): LegacySparkRetirementLocalCapturePublicState;
  withCapturedSnapshotForInternalUse<T>(consumer: (snapshot) => T): T | undefined;
  release(): void;
}>;
```

`withCapturedSnapshotForInternalUse` is an internal service-layer capability,
never passed to React. It lets a later trusted pipeline consume the closure-held
snapshot for R2.6.3b/assembly without returning raw data through
`getPublicState()`. Public UI and serializable state must never expose the
snapshot.

The session is deterministic and testable despite holding short-lived in-memory
references. Its only effects are calls to explicitly injected pure/synthetic
dependencies. c2b1 does not import the production browser wrapper directly;
c2b2 or a later runtime composition layer supplies it only after approval.

## Published c2b1 Status

R2.6.3c2b1 is published at
`315b24b695113ff1dcc8c6f633428e483b100c02`. It lives in
`src/legacySparkRetirementLocalCaptureSession.ts` with 45 synthetic checks in
`src/legacySparkRetirementLocalCaptureSessionChecks.ts`. It creates no
timestamp and calls no capture dependency during session creation or
`getPublicState()`. The only command is `prepareLocalSnapshot()`.

The module uses the published backup guide state machine directly, accepts only
injected timestamp and capture dependencies, keeps a successful snapshot in its
closure, and exposes only frozen text-free public state. The public snapshot
summary omits raw values and Spark/Package IDs. It imports no production c2a
browser wrapper, React, Drive, storage runtime, Writer DB bytes builder, crypto,
Blob, or download code.

## One-Shot And Concurrency Rules

The session keeps a private phase such as `ready`, `capturing`, `captured`, or
`released`; this is an execution lock, not a parallel guide state machine.

- One accepted user command starts at most one timestamp/capture attempt.
- `prepareLocalSnapshot` sets the lock before calling any dependency.
- A second call during `capturing` is rejected and calls nothing.
- A synchronous double-click cannot start a second attempt.
- The rule remains valid if capture later becomes asynchronous.
- A captured snapshot cannot be silently replaced.
- `incomplete` or `invalid` drops any internal snapshot reference.
- No automatic retry exists.
- A new attempt requires explicit `release`/`START_OVER`, a new session, and a
  new user command.

Rejected commands return only typed text-free reasons such as
`INVALID_TRANSITION`, `CAPTURE_ALREADY_IN_PROGRESS`, or
`CAPTURE_ALREADY_ATTEMPTED`. The local c2b1 command reasons stay separate from
the published guide model unless the guide itself already has a matching typed
reason.

## Canonical createdAt Factory

c2b1 may be the first layer to receive a timestamp factory. Its injected
factory returns one timestamp string and any thrown failure is mapped to a
typed text-free result:

- call exactly once per accepted attempt;
- success must be canonical `YYYY-MM-DDTHH:mm:ss.000Z`;
- forward the exact value unchanged to capture;
- retain the same `createdAt` for later Writer DB bytes, backup plan, and
  manifest composition;
- factory throw/rejection maps to `CREATED_AT_CREATION_FAILED` without
  exception text;
- malformed success is ultimately `INVALID_CREATED_AT` under the published
  snapshot contract and must not be treated as captured.

c2b1 does not call `Date.now()` or `new Date()`. A browser/runtime clock adapter
would be a later separately reviewed composition dependency.

## Mapping Capture Results To The Published Guide

c2b1 starts from `createLegacySparkRetirementBackupGuideState()` and uses only
the published `transitionLegacySparkRetirementBackupGuide(...)` events. The
accepted command sequence is:

| Step | Existing event | Existing next state |
| --- | --- | --- |
| Start command | `START_PREREQUISITE_CHECK` | `checking-prerequisites` |
| Confirm prerequisites | `PREREQUISITES_CONFIRMED` | `snapshot-capturing` |

Only after the guide reaches `snapshot-capturing` does c2b1 call timestamp and
capture dependencies. Capture results then map exactly:

| Capture result | Existing event | Existing next state |
| --- | --- | --- |
| `snapshot-captured` | `SNAPSHOT_CAPTURED` | `drive-reading` |
| `incomplete` | `SNAPSHOT_INCOMPLETE` | `incomplete` |
| `invalid` | `SNAPSHOT_FAILED` | `invalid` |

Reasons and safe summary metadata pass through the published transition
sanitizer. Raw snapshot data never enters an event or guide metadata. If any
pre-capture transition is rejected, timestamp creation and capture must not
start. No new parallel guide states or automatic Writer DB byte/Drive step is
introduced.

## Internal Snapshot Versus Public UI State

The session closure may retain one frozen `snapshot-captured` result internally.
`getPublicState()` returns only frozen, text-free data:

- guide status and typed reason codes;
- approved `createdAt`;
- Spark/Package/note counts and tombstone counts;
- Spark, Package, and Draft storage statuses;
- approved `nextAllowedStep`.

It must exclude raw Spark/Package/draft strings, Spark text, Package titles and
layers, note text, IDs unless separately approved, bytes, Storage objects,
callbacks, exception text, and mutable references.

The trusted service-layer `withCapturedSnapshotForInternalUse` callback may feed
the snapshot to the already published Writer DB bytes builder or a later
assembly coordinator. Its return value must remain internal or text-free; it is
not a React prop, context value, reducer action, browser event detail, or
serializable UI state.

## release And START_OVER

`release()` is idempotent and drops references to snapshot, Storage-derived
values, and any future Writer DB bytes. It must run on:

- `START_OVER`;
- closing or cancelling the guide;
- `invalid`;
- `incomplete` when no continuation is allowed;
- successful completion of the whole backup process;
- unmount of the future feature owner.

Release performs no localStorage write/delete/reset, tombstone, Drive call,
download, log, or analytics event. It only drops references and must not claim
physical memory wiping. `START_OVER` also uses the published guide transition
to return to `idle`; a fresh attempt still requires another explicit gesture.

## Future c2b2 Minimal UI Wiring

The docs-only c2b2 minimal UI capture review is published at
`b392600914a7a8e4eebe32644a97f99678e1bb41`. R2.6.3c2b2a is published at
`ae998764637075bf8bc341255903af23ce762232` as a headless synthetic controller.
The c2b2b design is documented in
`WRITER_LEGACY_SPARK_REACT_WIRING_REVIEW.md`. A later separately reviewed App
change may add one isolated retirement-backup subsection under Writer **Dáta**,
with:

- **Pripraviť lokálnu zálohu** button;
- short local/read-only explanation;
- disabled state while one command is active;
- text-free status, reasons, and summary only;
- cancel/`START_OVER` action that calls session `release()`;
- no raw content rendering.

No capture may run from render, mount, `useEffect`, import, timer, event
listener registration, PWA startup, or retry. One accepted click dispatches one
command; a double-click still produces one. c2b2 adds no Drive, bytes, assembly,
manifest, Blob/download, c3d, or R3 behavior. Existing DB export/import handlers
remain unchanged.

## Manual Gate Before The First Real Click

The first real-data click requires a new explicit chat approval after c2b1 and
c2b2 are separately reviewed and published and the worktree is clean. Before
that click confirm:

- expected commits are published and the worktree is clean;
- intended production domain and browser profile are correct;
- no pending autosave, unsaved edit, or non-empty draft is being ignored;
- DevTools Network and a storage-write audit are ready;
- only Spark, Package, and Draft keys can be read;
- no `setItem`, `removeItem`, `clear`, Drive, network side effect, or download;
- UI cannot display raw author content;
- localStorage values are unchanged after capture;
- result is only `snapshot-captured`, `incomplete`, or `invalid`;
- no automatic continuation or R3 action occurs.

This checklist is not authorization to implement or perform the click.

## Errors And Retry

Text-free handling applies to `LOCAL_STORAGE_UNAVAILABLE`, the three per-key
read failures, `CREATED_AT_CREATION_FAILED`, `INVALID_CREATED_AT`,
`CAPTURE_DEPENDENCY_FAILED`, `DRAFT_PRESENT`, parse/shape failures, and
duplicate Spark/Package IDs.

- Never expose raw data, exception text, stack, or partial snapshot.
- Never retry automatically.
- Release the previous session reference before an explicit retry.
- Retry requires a new user action and a fresh one-shot guard.
- `incomplete` and `invalid` do not create Writer DB bytes or advance to Drive.

## Privacy And Side-Effect Boundary

Real data may be read only after the approved c2b2 click. It remains local and
in memory. There is no server, Drive call during capture, network, analytics,
clipboard, logging/error reporting with content, storage write, or mutation of
the raw snapshot. React sees only text-free public state.

## c2b / R2.6.3d Boundary

c2b owns only the initial user-invoked capture and session lifetime. Separate
R2.6.3d may, after an async Drive phase, reread the same three raw values,
compare them with the original internal snapshot, and return
`LOCAL_SNAPSHOT_CHANGED`. It cannot replace the original snapshot, merge,
repair, normalize, or write data. c2b does not implement consistency checking.

## Synthetic Test Plan For c2b1

Prove creation and `getPublicState()` read nothing; only
`prepareLocalSnapshot()` calls dependencies; timestamp and capture are each
called exactly once; double/parallel calls are rejected; captured state cannot
be overwritten; invalid/incomplete results are text-free; guide transitions
match the published machine; rejected transitions call nothing; release and
`START_OVER` drop references and write nothing; a new explicit action works
only after release; public state excludes raw snapshot; and source has no clock,
window/storage, React, Drive/network, Blob/download, backup verification, or R3.

## Automated And Manual Plan For c2b2

Automated UI tests must prove render, mount, and effects read nothing; one click
issues one command; double-click remains one; active capture disables the
button; UI shows only text-free state; `START_OVER` calls release; and there is
no retry, Drive, or download. All dependencies remain synthetic.

The manual test happens only after separate approval. It confirms the first
real read occurs solely on the conscious click, only three keys are read, no
network/storage write occurs, and no data is deleted or changed afterward.

## Status And Explicit Non-Goals

c2b stops at the existing local snapshot guide result. It does not
automatically create `writer-db-bytes-built`, `assembly-verified`,
`backup-presented`, `backup-verified`, `ready-to-create-tombstones`, or
`completed`.

The published c2b1 implementation does not implement App/UI wiring, a real
storage read, Drive GET, post-Drive consistency, hashing, assembly, manifest,
Blob/download, R3, tombstones, data reset, or purge.

## Smallest Safe Implementation Step

The c2b2b1 isolated React panel is now prepared locally with an injected
synthetic controller factory and 45 focused checks. It remains outside
`App.tsx`, does not import production c2a, and preserves one explicit
**Pripraviť lokálnu zálohu** click handler plus the manual gate before
the first real c2a/localStorage read. The smallest next step is a docs-only
c2b2b2 production composition review; App placement remains a separate gate.
