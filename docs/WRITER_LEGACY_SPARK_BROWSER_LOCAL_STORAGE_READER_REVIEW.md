# Writer Legacy Spark Browser Local Storage Reader Review

R2.6.3c2 is a docs-only safety review of the future browser boundary above the
published R2.6.3c1 injected coordinator. This review implements no wrapper or
UI, accesses no browser storage, reads no real Writer data, and creates no
backup, hash, manifest, Blob, download, commit, push, or deployment.

## Decision: Split c2a From c2b

Keep two separately reviewed steps:

- **R2.6.3c2a — import-safe browser wrapper module.** It defines one callable
  adapter but is not wired into App or UI. Importing the module, obtaining a
  function reference, rendering, starting the PWA, or running an effect does
  nothing. Its tests use only an isolated synthetic browser/storage double.
- **R2.6.3c2b — explicit one-shot invocation.** A later, separately approved UI
  coordination change may invoke c2a only after a clear user gesture such as
  **Pripraviť lokálnu zálohu**. c2b, not c2a implementation or import, is the
  first step allowed to read real Writer data.

This split prevents the browser-capable module from creating an automatic data
read merely because it exists or is imported.

## Proposed c2a API

```ts
captureLegacySparkRetirementBrowserLocalStorageSnapshot(
  input: Readonly<{
    createdAt: string;
  }>
): LegacySparkRetirementLocalSnapshotResult;
```

Only an explicit function call may execute this sequence:

1. Confirm a browser environment is available.
2. Inside one `try`, evaluate `window.localStorage` exactly once and retain the
   returned object in a function-local constant.
3. If no usable object is available or property access throws, return frozen
   `invalid` with frozen `reasons: ["LOCAL_STORAGE_UNAVAILABLE"]`.
4. Create only `readStorageValue: key => storage.getItem(key)` over that same
   retained object.
5. Call published
   `captureLegacySparkRetirementLocalStorageSnapshot(input,
   { readStorageValue })` exactly once.
6. Return its result transparently.

The wrapper does not know or repeat the three storage keys. Published c1 owns
Spark -> Package -> Draft ordering, exact once-per-key reads, raw mapping,
parsing delegation, and per-key read failures.

## No Import-Time Or Automatic Access

The future c2a module must not:

- evaluate `window.localStorage` at module scope;
- retain a Storage object or raw snapshot in module-level state;
- call capture during import or function-reference creation;
- run capture during App initialization, React render, automatic `useEffect`,
  PWA startup, service-worker startup, background work, or storage events;
- export an already-created snapshot or promise.

All browser-global inspection belongs inside the callable function body. A
plain module import must be safe in TypeScript checks, Node, SSR, tests, and a
browser before user action.

## Storage Availability Boundary

Return `LOCAL_STORAGE_UNAVAILABLE` when the wrapper is explicitly called and:

- no browser `window` exists;
- `window` has no usable `localStorage` object;
- access to the `localStorage` property throws `SecurityError` or any other
  exception.

The reason is text-free. Do not return exception name, message, stack, origin,
browser profile, storage content, or account information. Add the reason to the
shared retirement reason union only in the future c2a implementation.

Once one Storage object has been acquired successfully, `getItem` failures are
not availability failures. Published c1 remains authoritative:

- Spark `getItem` throws -> `SPARK_STORAGE_READ_FAILED`;
- Package `getItem` throws -> `PACKAGE_STORAGE_READ_FAILED`;
- Draft `getItem` throws -> `DRAFT_STORAGE_READ_FAILED`.

## Exactly One Storage Object

One explicit c2a invocation may evaluate the `window.localStorage` getter only
once. The same retained object supplies all three c1 reads. The wrapper must not
reread the property per key, enumerate storage, inspect `storage.length`, call
`storage.key()`, or use `setItem`, `removeItem`, or `clear`.

The local Storage reference lives only for that synchronous invocation. It is
not cached, returned, placed in React state, or shared with later attempts.

## Explicit User-Gesture Boundary For c2b

Before the later approved click:

- no retirement localStorage read occurs;
- no retirement snapshot exists in memory;
- importing c2a has no observable storage effect.

After one clear user click, a higher backup coordinator may:

1. Create one canonical `YYYY-MM-DDTHH:mm:ss.000Z` timestamp.
2. Call c2a exactly once with that explicit `createdAt`.
3. Give UI only a text-free status or existing text-free summary.
4. Keep raw snapshot data outside public UI/React state.

This review does not add the action, button, coordinator, or App wiring.

## createdAt Ownership

c2a accepts and forwards `createdAt` unchanged. It must not call `Date.now()`,
construct `new Date()` as a clock, derive time from storage, or provide a
fallback. Published R2.6.3a remains the canonical timestamp validator. The
future user-gesture coordinator owns timestamp creation, separately from the
browser wrapper.

## Result And Status Boundary

c2a may transparently return only the c1/R2.6.3a statuses:

- `snapshot-captured`;
- `incomplete`;
- `invalid`.

The only wrapper-owned result is compatible frozen `invalid` with
`LOCAL_STORAGE_UNAVAILABLE`. It must not return `writer-db-bytes-built`,
`assembly-verified`, `backup-presented`, `backup-verified`,
`ready-to-create-tombstones`, or `completed`.

## Privacy And Snapshot Lifetime

The first real raw values may be read only by approved c2b after the explicit
gesture. They stay local and in memory for one backup attempt. There is no
server, Drive call, network request, logging, analytics, clipboard, download,
or raw JSON/author text in UI or React state. Public UI receives only text-free
status, reasons, or summary.

On success, failure, cancellation, superseding attempt, or `START_OVER`, the
higher coordinator must drop all snapshot and Storage references. No module
cache, singleton, persisted state, background retry, or automatic reread is
allowed. JavaScript cannot guarantee immediate physical erasure, so the design
minimizes reference lifetime instead of claiming secure wiping.

## Synthetic Test Plan For c2a

Use an isolated fake browser realm and fake Storage only; never use a real
profile or real Writer data. Prove:

- importing the module does not inspect browser storage;
- obtaining a function reference does not inspect browser storage;
- acquisition happens only after explicit function invocation;
- the `localStorage` getter is evaluated exactly once per call;
- the same Storage object receives all three `getItem` calls;
- missing browser, missing storage, and throwing property getter return frozen
  `LOCAL_STORAGE_UNAVAILABLE` without exception text;
- a successful fake object delegates exactly once to published c1;
- Spark, Package, and Draft `getItem` throws preserve c1 reason codes;
- Spark -> Package -> Draft order and exactly-once key reads remain intact;
- no `setItem`, `removeItem`, `clear`, `length`, or `key()` access;
- no automatic capture, clock, Drive, fetch, crypto, Blob, File, download,
  Writer DB byte construction, logging, analytics, or UI behavior;
- public errors contain no raw value or author text;
- return states never exceed `snapshot-captured`, `incomplete`, or `invalid`.

## Manual Safety Checklist For c2b

The first real-data test requires separate explicit approval and must verify:

- the app is open on the intended production domain and the user knowingly
  invokes **Pripraviť lokálnu zálohu**;
- no retirement read or snapshot exists before the click;
- no `setItem`, `removeItem`, `clear`, repair, or migration occurs;
- only the approved Spark, Package, and Draft keys are read, once each;
- raw text is absent from UI, logs, errors, analytics, and clipboard;
- local capture triggers no network request, Drive call, Blob, or download;
- the result remains `snapshot-captured`, `incomplete`, or `invalid`;
- ending or `START_OVER` drops references;
- the test deletes, resets, purges, or edits nothing.

This checklist is not authorization to run the manual test.

## R2.6.3c2 / R2.6.3d Boundary

c2 performs only the initial synchronous browser capture. It does not wait for
Drive or verify that local data stayed unchanged.

R2.6.3d remains a separate post-Drive consistency checker. After the future
async Drive operation, it may reacquire storage under its own reviewed
read-only boundary, reread the same Spark, Package, and Draft raw values, and
compare exact raw states with the original snapshot. Any difference returns
`LOCAL_SNAPSHOT_CHANGED`. It performs no merge, repair, write, reset, or
normalization. c2 must not implement or invoke d.

## Explicit Non-Goals

This review does not implement a browser wrapper, UI/button, user gesture,
actual localStorage read, Writer DB bytes, Drive GET, hashing, assembly,
manifest, Blob/download, consistency checker, R3, tombstones, reset, or purge.

## Published c2a Status And Smallest Next Step

R2.6.3c2a is published at
`58b99036878b9975c527373f66b82e248bee9408` in
`src/legacySparkRetirementBrowserLocalStorageCapture.ts` with 39 synthetic
checks. Its injected helper acquires one Storage-like object exactly once,
validates `getItem`, delegates the same object to published c1, and returns a
frozen text-free `LOCAL_STORAGE_UNAVAILABLE` when acquisition fails. The public
wrapper is lazy and import-safe; it has no App/UI wiring and was exercised only
in a nonbrowser Node fallback, never against real localStorage or Writer data.

Do not combine c2a with c2b. The completed docs-only review is in
`WRITER_LEGACY_SPARK_USER_GESTURE_CAPTURE_REVIEW.md`: c2b1 owns pure synthetic
session logic and c2b2 owns later UI wiring. c2b1 is published at
`315b24b695113ff1dcc8c6f633428e483b100c02` with 45 synthetic checks and still
does not import this production browser wrapper. The docs-only c2b2 minimal UI
capture review is published at
`b392600914a7a8e4eebe32644a97f99678e1bb41`. R2.6.3c2b2a is prepared locally as
a headless synthetic controller and still does not import this production
browser wrapper; the first real Writer-data read remains the explicitly
approved c2b2b click.
