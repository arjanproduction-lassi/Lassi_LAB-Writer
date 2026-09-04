# WriterPackage Workshop Development Wiring Review

## Status And Scope

This docs-only review defines the smallest safe route from the published pure
WriterPackage editing foundations to an isolated development-only workshop.
The published foundation is:

- Phase D contract: `f780e27627ee82e3a35fac891c99d0e2f60dd911`;
- D1 pure edit planner: `362a0de3136dbeabe5864f7d5122fb30d61735f8`;
- D2a strict collection codec: `25d37879f78e9837ebf960394847c8dc3af5ca28`;
- D2b injected persistence coordinator:
  `90291b81967eb012bacafd69fd2c3987c55eb294`;
- D3 pure autosave state machine:
  `8bf0d20e4b83eae0907ac89689716db1d34a1579`;
- D4a pure result bridge:
  `b110a0de6198c9aece6ba36df61285912155e84c`;
- D4b injected editing session:
  `8de1bf0bcf85d5aa5f4aa1f46549e8d6dc6cea7f`.

The earlier docs-only review added no runtime. The current local D4c slice adds
only unwired browser-adapter code and artificial checks: no React, CSS,
production route, production navigation, deployment, real author-data test,
new storage key, or UI wiring. D4a is published. D4b is published as the
injected editing session and artificial checks described below. D4c now locally
adds only the unwired browser adapters described below; D4d remains
unimplemented.

Production editing remains **NO-GO**. D4 is only a disposable-profile
development gate; it does not resolve crash recovery or cross-device Package
sync.

## Why D4 Must Be Split

D2b performs a strict compare-then-write with verified read-back, but browser
localStorage has no atomic compare-and-set. Two tabs can still pass the initial
revision check before either writes. The existing Phase D contract therefore
requires a separate single-writer or browser-lock decision before D2b is wired.

Combining mode selection, lock ownership, strict readiness, autosave
coordination, browser persistence, timers, and React rendering in one commit
would make the first real Package write too difficult to review. D4 is split
into narrow gates:

- **D4a:** published pure typed bridge from D2b results to D3 events and view
  status;
- **D4b:** injected development editing session with private draft ownership;
  published with artificial checks;
- **D4c:** browser lock, storage, time, timer, mode, and `beforeunload`
  adapters, now implemented locally without React;
- **D4d:** exact DEV-only product-shell UI wiring and synthetic integration
  checks;
- **D5:** disposable-profile manual acceptance before any production decision.

Each gate remains uncommitted until its own checks and safety review pass.

## Development Mode Boundary

The only editing selector is the exact query value:

```text
?mode=real-edit-workshop
```

The pure mode resolver may return `real-edit-workshop` only when the injected
development flag is true and the decoded selected value matches exactly.
Production, missing, blank, malformed, case-mismatched, or unknown values fail
closed to fixture mode.

The mode is non-persistent. It creates no preference or storage key. The
production `index.html`, `main.tsx`, `App.tsx`, navigation, Writer DB import,
export, recovery, and Google Drive sync remain outside D4.

## One Global Writer Lock

D4 chooses an exclusive browser Web Lock for the entire WriterPackage
collection, not one lock per Package. D2b rewrites the single complete Package
collection, so two different Package editors would still compete for the same
key.

The development browser adapter may request one fixed, non-persistent lock name
in exclusive `ifAvailable` mode. The lock name is not a storage key and contains
no Package ID, title, draft, or author text.

Rules:

- acquire only after an explicit request to open a real editable Package;
- hold the lock for the complete editing session;
- release it on confirmed return, package change, mode teardown, or unload;
- never wait indefinitely for another tab;
- if Web Locks are unavailable, denied, or lost, remain read-only;
- fixture and `real-read-only` modes never request the lock;
- React render, import, module evaluation, and ordinary Library display never
  request the lock;
- do not reuse the Writer DB transaction marker or add a lock storage key.

This lock coordinates only D4-aware tabs. An older or unrelated writer can
still ignore it, so D2b's expected-revision and read-back checks remain
mandatory. D4 must not claim general cross-tab atomicity or production safety.

## Fresh Editable Package Gate

The read-only Library may continue to use its existing one-load catalog
snapshot for presentation. That snapshot is not sufficient write authority
because it can contain adapted legacy Sparks and is built through filtering
loaders.

After lock acquisition and before enabling the editor, a thin injected browser
boundary reads the existing WriterPackage collection key once and passes the
raw value to the strict D2a codec. Editing is enabled only when:

- the raw value exists and the complete collection parses strictly;
- IDs are unique and every Package is supported and valid;
- the selected ID belongs to a real stored WriterPackage;
- the Package is not tombstoned;
- its `updatedAt` exactly matches the selected read-only snapshot;
- lock ownership is still active.

Adapted legacy Sparks, missing or tombstoned Packages, stale snapshots,
malformed collections, loader failure, and absent lock ownership remain
read-only with stable text-free reasons. No repair, filtering, migration, or
write is allowed during readiness inspection.

## D4a Pure Result Bridge

D4a receives a D3 saving state and one already-produced D2b result. It performs
no storage, clock, timer, browser, React, or network work. It reads only the
result discriminant, timestamps, and failure facts needed for the transition;
it never copies the returned Package, Package identity, or author content into
the D3 event, transition, or public output. Inputs in its checks are artificial.
It maps exactly:

- D2b `saved` to D3 `save-succeeded` with the captured local revision,
  `previousUpdatedAt`, and verified `nextUpdatedAt`;
- D2b `unchanged` to D3 `save-unchanged` with the returned Package
  `updatedAt`;
- D2b `conflict` to D3 `save-conflicted` with `currentUpdatedAt`;
- D2b `blocked` to a text-free D3 safe failure at stage `blocked`, with no
  write attempted and storage state `not-written`;
- D2b `failed` to D3 `save-failed`, preserving stage, write attempt, rollback
  attempt, rollback success, and truthful storage state.

The bridge delegates transition validity to D3. A rejected or mismatched result
cannot update UI state, start another persistence call, or discard a draft.
Only after an accepted `saved` or `unchanged` bridge transition may the later
private D4b session refresh its selected Package from the original D2b result.
The Package is not returned by D4a.

## D4b Injected Editing Session

The session owns Package ID, current draft, and selected detached Package
privately. Its public autosave state and failure metadata remain text-free.
Dependencies are injected:

- fresh editable-Package inspector;
- one persistence function matching the D2b result contract;
- current-time supplier used only for an accepted save command;
- write-ownership check and release boundary.

The browser Web Lock acquisition and debounce scheduler/canceller are not D4b
dependencies; they remain D4c browser responsibilities.

Opening a session performs no write. One text edit updates the private draft
and applies D3 `edited`. One accepted debounce applies `save-requested`; only
its emitted `persist-workshop` command may invoke D2b exactly once. D2b receives
the existing Package key, selected Package ID, captured expected `updatedAt`,
current private workshop text, and one injected canonical time.

Editing during `saving` advances the local revision. A late success updates the
verified base but leaves the newer draft dirty. Conflict stops automatic retry.
Safe failure retains the draft and requires explicit retry. Unsafe failure
blocks retry.

## D4c Browser Adapters

The local D4c implementation adds `writerPackageWorkshopBrowserAdapters.ts`
and artificial checks only. It remains unwired from React, product-shell
rendering, and production entries. The browser composition is allowed only
under exact DEV edit mode. It may:

- inject `window.localStorage` through the narrow D2b interface;
- inject the existing `WRITER_PACKAGE_STORAGE_KEY` only;
- inject one current canonical ISO timestamp per accepted persistence command;
- acquire and release the fixed Web Lock;
- schedule and cancel one debounce timer;
- register a conditional `beforeunload` warning while D3 reports an unsaved
  draft.

It must not enumerate storage, call `removeItem`, create a new key, access Spark
storage, reuse import persistence, call Google Drive, log raw JSON or author
text, or write on module import, render, mount, mode resolution, Library load,
Package open, or lock acquisition.

D4c exports only narrow adapter surfaces:

- `resolveWriterPackageWorkshopEditMode()` returns `real-edit-workshop` only
  for the exact decoded query value under an injected development flag;
- `createWriterPackageWorkshopBrowserStorage()` forwards only `getItem` and
  `setItem` from an injected storage object;
- `inspectWriterPackageWorkshopBrowserEditablePackage()` strictly reads and
  validates the existing Package collection before editability;
- `createWriterPackageWorkshopBrowserNow()` supplies a canonical ISO timestamp
  per call;
- `acquireWriterPackageWorkshopBrowserWriteOwnership()` requests the fixed
  exclusive, non-waiting Web Lock and returns explicit ownership;
- `createWriterPackageWorkshopDebounceScheduler()` keeps one pending timer;
- `createWriterPackageWorkshopBeforeUnloadGuard()` registers a text-free
  warning only while D3 reports unsaved state;
- `createWriterPackageWorkshopBrowserSessionDependencies()` composes the D4c
  adapters into the published D4b dependency contract.

Synthetic D4c checks cover 33 adapter behaviors and four source-isolation
guards. They use only artificial Package bytes and injected browser-like
dependencies. They do not invoke real `window.localStorage`, real Web Locks,
real author data, React, Google Drive, or Writer DB import/export/recovery.

## D4d Development UI

The UI reuses the current real read-only Library and detail structure. Only a
fresh real Package with active global lock may expose an editable
`workshopText` textarea. Title, Spark, notes, final text, context panels,
adapted Sparks, tombstoned Packages, and **Nová iskra** remain read-only or
disabled.

The banner must state that edits are local-only, not crash-recoverable beyond
the last verified autosave, and not included in current Google v1/Sparks-only
sync.

Visible save states are `Neuložené`, `Ukladám…`, `Uložené`, `Konflikt`, and
truthful safe or unsafe failure. Conflict has no overwrite action. Safe failure
may show an explicit retry. Unsafe failure has no retry.

Package switch, layer switch, Library return, reset, and unload use the D3 exit
decision. Unsaved state requires explicit confirmation; a rejected exit keeps
the same selection, layer, draft, lock, and autosave state. Double click,
StrictMode effects, and repeated debounce events cannot invoke two coordinator
calls.

## Synthetic Test Plan

### D4a

- every D2b result maps to the exact D3 event;
- rollback and storage-state facts are preserved;
- blocked maps to safe not-written failure;
- mismatched save revision is rejected without state change;
- no Package identity or author text is copied into returned state or command;
- no storage, browser, time, React, network, mutation, or logging.

### D4b

- open is write-free and only fresh real Package becomes editable;
- legacy, deleted, missing, stale, damaged, and lock-denied inputs stay
  read-only;
- one edit becomes dirty and one accepted debounce performs one persistence
  call;
- editing during save remains dirty after old success;
- double save produces one call;
- conflict blocks automatic retry;
- safe failure allows explicit retry and unsafe failure blocks it;
- all five exit actions preserve an unconfirmed draft;
- previous state and inputs are not mutated;
- fixtures contain no real author text.

### D4c/D4d

- exact DEV query enables the development composition;
- production and every other query resolve to fixture mode;
- fixture and read-only modes acquire no lock and perform no storage access;
- lock unavailable or unsupported stays read-only;
- only the existing Package key is read or written;
- no write occurs before an accepted save command;
- title, Spark, notes, and final text expose no change handlers;
- adapted Spark never becomes editable;
- verified save refreshes only the selected Package snapshot;
- navigation/unload warning follows D3 state;
- current Google sync remains visibly Sparks-only;
- `App.tsx`, production entry, storage helpers, Writer DB, and Google Drive have
  zero diff.

## Manual Acceptance Gate

D5 uses a disposable browser profile and artificial disposable Package only.
It must verify editor focus and labels, PC/mobile layout, 200% zoom, debounce,
double click, second-tab lock denial, conflict, reload after verified save,
ordinary navigation warning, offline behavior, and truthful local-only copy.

No existing author Package or production deployment may be used for the first
write test. Manual acceptance does not authorize production cutover.

## Out Of Scope

D4 does not add or authorize:

- production editing or product-shell cutover;
- a draft, lock, backup, transaction, or preference storage key;
- crash recovery for dirty in-memory text;
- Package creation, title/Spark/note/final editing, deletion, restore, or merge;
- adapted Spark editing or Spark-to-Package migration;
- Google Drive v2, Package sync, import/export, or recovery changes;
- Writer DB marker reuse;
- real author-data testing, deployment, or automatic production navigation.

## Smallest Next Step

Complete the final safety review and publish D4c as its own isolated browser
adapter commit. Do not start D4d, React UI, CSS, production App wiring, real
author-data testing, Package creation, draft recovery, production editing, or
Package sync in the same commit.
