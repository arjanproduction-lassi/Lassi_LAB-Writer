# WriterPackage Editing And Autosave Review

## Status And Scope

This is the docs-only Phase D review for editing one layer of one real stored
WriterPackage. It follows the closed read-only Library/detail work published
through `f268d569a1c45214090dcac326633afab76c6968`.

This review changes no runtime, React, CSS, storage key, WriterPackage shape,
Writer DB format, import/export behavior, recovery behavior, Google Drive
payload, production route, or navigation. It does not stage, commit, push,
deploy, read real author data, or write browser storage.

Phase D must remain separate from:

- Phase E direct WriterPackage creation through **Nová iskra**;
- Phase F production shell cutover and legacy Spark UX relocation;
- legacy Spark backup, tombstone, reset, purge, or migration work;
- WriterPackage Google Drive synchronization;
- any new persistent draft key.

## Decision

The smallest Phase D editing slice is **Dielňa / `workshopText` only** for a
WriterPackage that is proven to exist in the real Package storage collection.

Keep these fields read-only in the first slice:

- `title`;
- `sparkText`;
- `notes` and note identities;
- `finalText`;
- `createdAt`, `deletedAt`, `packageVersion`, and `legacy` metadata.

`workshopText` is the smallest safe first field because it is one package-level
string and does not require note identity, note tombstone, ordering, creation,
or deletion rules. The original `sparkText` remains the protected birth record
of the work. `finalText`, title editing, and notes need later separate reviews.

The first implementation must remain pure and synthetic. Real storage and UI
wiring are later gates.

## Write Ownership

The combined result of `loadWriterPackageCatalog()` is a read-only browsing
source, not a write source. It mixes:

- real WriterPackages from `lassilab-writer:v0.1:packages`;
- visible legacy Sparks adapted in memory into WriterPackage-shaped values.

An adapted Spark must never become writable merely because it has a
WriterPackage shape. `legacy.source === "spark"` is also not sufficient proof
of physical storage provenance because a real stored WriterPackage may retain
legacy metadata.

Write ownership is proven only by finding the selected ID in a freshly read,
fully validated real Package storage collection. Therefore:

- selected catalog item absent from real Package storage -> read-only;
- selected real Package tombstoned -> blocked;
- malformed Package storage -> blocked, never treated as empty;
- duplicate Package IDs -> blocked;
- selected Package `updatedAt` different from the editor base revision ->
  conflict, no write;
- a real Package that retains `legacy` metadata may still be writable because
  physical membership, not metadata, owns the decision.

Phase D must not use `getWriterPackageById()` as the complete safety boundary,
because it uses the current filtering loader and cannot report malformed
collection state. The runtime may reuse lower-level validation logic, but the
write coordinator needs one explicit raw/injected collection read with typed
failure results.

## Existing Storage Helper Audit

The current helpers are adequate for the existing foundation but not sufficient
as a direct autosave coordinator:

### `loadWriterPackages()`

- reads the existing Package key;
- returns `[]` for a missing key, malformed JSON, or non-array input;
- filters invalid records instead of surfacing collection damage.

That behavior is useful for resilient read-only browsing but unsafe for writes:
writing its filtered result could silently discard damaged or unsupported
records.

### `saveWriterPackages(packages)`

- serializes and writes the whole collection;
- performs no full validation before the write;
- performs no read-back validation;
- returns no typed success or failure result.

### `upsertWriterPackage(writerPackage)`

- silently returns the current filtered collection when the supplied Package
  is invalid;
- re-reads through `loadWriterPackages()`;
- has no expected-revision comparison;
- writes the whole filtered collection;
- has no read-back verification or rollback result.

Phase D must not call `saveWriterPackages()` or `upsertWriterPackage()` directly
from React autosave. They may remain unchanged for compatibility while a new,
separately tested injected persistence boundary is introduced later.

## D1 Pure Workshop Edit Plan

The first implementation slice should be a pure deterministic helper, for
example:

```ts
type PlanWriterPackageWorkshopEditInput = Readonly<{
  packages: readonly WriterPackage[];
  packageId: string;
  expectedUpdatedAt: string;
  workshopText: string;
  now: string;
}>;

type WriterPackageWorkshopEditPlan =
  | Readonly<{
      status: "ready";
      packages: readonly WriterPackage[];
      updatedPackage: WriterPackage;
      previousUpdatedAt: string;
      nextUpdatedAt: string;
    }>
  | Readonly<{
      status: "unchanged";
      package: WriterPackage;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-package-collection"
        | "duplicate-package-id"
        | "package-not-found"
        | "package-deleted"
        | "stale-revision"
        | "invalid-now";
    }>;
```

Exact rules:

1. Validate every supplied WriterPackage and reject duplicate IDs.
2. Require a non-empty `packageId` and exact selected Package match.
3. Block a tombstoned Package.
4. Require `expectedUpdatedAt === current.updatedAt`.
5. If `workshopText` is byte-for-byte equal to the stored value, return
   `unchanged` and do not advance time.
6. Otherwise change only `workshopText` and top-level `updatedAt`.
7. Preserve collection order and every other Package field.
8. Preserve note order, identities, timestamps, tombstones, and text unchanged.
9. Produce a canonical ISO `nextUpdatedAt` that is strictly later than the
   current Package revision. If injected `now` is equal or older, advance from
   the current revision by one millisecond.
10. Return deeply detached, frozen results and never mutate inputs.

The pure helper imports no React, browser globals, storage, timers, network,
Google Drive, import/export, recovery, persistence, random ID, or logging API.

## D2 Injected Single-Key Persistence

A later D2 coordinator may connect D1 to the existing Package key through an
injected storage interface. It must use exactly:

```text
lassilab-writer:v0.1:packages
```

No new key is introduced by D1 or D2.

Required sequence:

1. Read the exact raw Package value once.
2. Distinguish missing, malformed, unsupported, invalid, and duplicate data.
3. Parse a complete collection without filtering records.
4. Call D1 with the current collection and expected editor revision.
5. Return `unchanged`, `blocked`, or `conflict` without `setItem`.
6. Serialize the complete planned collection in memory.
7. Write the one existing Package key once.
8. Read it back, parse it strictly, and compare the complete collection with the
   planned result.
9. Report success only after read-back verification.
10. If verification fails after a successful write, restore the exact previous
    raw value, read it back, and report whether rollback was verified.

Because editing is allowed only for an already stored Package, the previous raw
Package value must exist. D2 therefore needs no `removeItem` path and may not
create another backup, marker, or draft key.

Typed results must preserve:

- `saved` with the verified updated Package and next revision;
- `unchanged` with no write;
- `conflict` with no write;
- `blocked` with a stable reason and no write;
- `failed` with write stage, rollback-attempted, rollback-succeeded, and
  truthful current-state safety.

Exception messages, raw JSON, author text, package titles, IDs, and draft text
must not enter public failure copy or logs.

## D3 Pure Autosave State Machine

Autosave coordination should be pure before React wiring. Recommended states:

- `read-only`;
- `clean`;
- `dirty`;
- `saving`;
- `saved`;
- `conflict`;
- `failed-safe`;
- `failed-unsafe`.

The state machine carries a monotonically increasing local edit revision. One
accepted save request captures the current local revision and base
`updatedAt`. A late save result may update the stored base revision, but it must
not mark a newer local draft as saved.

Rules:

- one save may be active at a time;
- editing during `saving` produces a newer dirty revision;
- successful save of an older revision schedules the current dirty revision
  later rather than discarding it;
- stale storage revision becomes `conflict` and stops automatic retries;
- a safe failure retains the in-memory draft and allows explicit retry;
- an unsafe rollback result blocks further saving;
- double events cannot produce two concurrent coordinator calls;
- reset, package switch, Library return, and layer switch cannot silently drop
  dirty, saving, conflict, or failed text;
- public state and reasons remain text-free; author content stays in the private
  editor/controller boundary.

The pure state machine owns no clock, debounce, storage, browser event,
React state, or network call.

## D4 Development-Only Workshop Wiring

Only after D1-D3 are separately reviewed may an isolated development mode wire
real Package editing. A possible exact query mode is:

```text
?mode=real-edit-workshop
```

It must resolve to fixture mode outside `import.meta.env.DEV`, exactly like the
current read-only mode boundary. It must remain unreachable from production
navigation and `App.tsx`.

The development UI may:

- open the existing read-only snapshot;
- verify fresh real Package write ownership before enabling the editor;
- edit only the active `workshopText` field;
- keep context panels read-only;
- debounce an autosave request in the thin React layer;
- display `Neuložené`, `Ukladám…`, `Uložené`, `Konflikt`, or a truthful failure;
- warn before unload or navigation while dirty, saving, conflicted, or failed;
- refresh the Library/detail snapshot only from a verified save result.

The development UI must not:

- enable title, Spark, notes, or final-text editing;
- edit adapted legacy Sparks;
- call `upsertWriterPackage()` directly;
- create WriterPackages or enable **Nová iskra**;
- change the selected package ID during a save;
- automatically overwrite a conflict;
- log author text or serialize drafts into test artifacts;
- call Google Drive or mark Sparks-only sync preferences as Package-safe;
- change production `index.html`, `main.tsx`, `App.tsx`, or navigation.

The banner must say that WriterPackage changes are local-only and not carried by
the current Google v1/Sparks-only sync.

## Draft Recovery Boundary

D1-D4 introduce no new storage key. Therefore the only data guaranteed after a
reload is the last Package value that passed persistence read-back. A dirty
in-memory draft can be protected from ordinary navigation with a warning, but
it cannot survive a browser crash or forced reload.

Production editing is **NO-GO** until a separate review explicitly chooses one
of these contracts:

1. add one reviewed WriterPackage draft key with validation, ownership,
   recovery, cleanup, export/privacy, and conflict rules; or
2. accept and clearly communicate last-successful-autosave recovery only.

The recommended product direction is a reviewed draft-recovery key, because an
author's workshop should recover work after a crash. That key is not named,
created, or authorized by this document.

The existing `lassilab-writer:v0.1:draft:new-spark` key must not be reused: its
schema and ownership belong to the legacy new-Spark capture flow.

## Google And Cross-Device Boundary

Current Google Drive sync writes Writer DB v1 and carries Sparks only. A local
WriterPackage autosave must not:

- claim that the Package is synchronized;
- mark a Package change as safely carried by the current v1 sync;
- upload a v2 payload implicitly;
- modify `googleDriveSync.ts` or its filename/schema;
- delete or rewrite a Spark with the same ID.

Development mode must show `Lokálne · bez synchronizácie` or equivalent
truthful copy. Production Phase D/E/F cutover is blocked until there is a
separate decision to support local-only WriterPackages or a reviewed Package
sync contract.

## Test Plan

### D1 pure checks

- valid `workshopText` change updates only that field and `updatedAt`;
- empty text is a valid explicit edit;
- unchanged text performs no update;
- strictly newer injected time is used;
- equal or older injected time becomes current revision plus one millisecond;
- invalid time blocks;
- missing, deleted, invalid, or duplicate Package blocks;
- stale expected revision blocks;
- input arrays, Packages, legacy metadata, and notes are not mutated;
- collection and note order remain unchanged;
- output is deeply detached and frozen;
- no browser, storage, time, randomness, network, or React dependency exists.

### D2 injected persistence checks

- missing/malformed/non-array storage blocks before writes;
- one invalid or duplicate record blocks instead of being filtered;
- adapted catalog-only ID cannot be written;
- stale revision performs zero writes;
- unchanged text performs zero writes;
- ready plan writes the existing Package key once;
- success requires exact read-back validation;
- write failure preserves the previous raw value;
- verification failure attempts exact raw rollback;
- failed rollback is reported truthfully and blocks another save;
- unrelated Packages, tombstones, notes, and legacy metadata remain identical;
- no Spark key, Google preference, import key, marker, backup, or new key is
  touched.

### D3/D4 state and UI checks

- one input becomes dirty and one accepted debounce becomes saving;
- double debounce/click cannot start two writes;
- editing during save keeps the newer draft dirty after old success;
- conflict never auto-overwrites;
- safe failure retains the draft and supports retry;
- unsafe failure blocks retry and navigation without confirmation;
- Package switch, layer switch, Library return, reset, and unload preserve the
  dirty-state warning;
- only a fresh real stored Package enables `workshopText` editing;
- adapted Spark, tombstoned Package, missing Package, and loader failure stay
  read-only;
- title, Spark, notes, and final text have no change handlers;
- exact edit mode is DEV-only and production falls back to fixture mode;
- no real author content appears in tests, snapshots, console, or committed
  artifacts.

## Manual Acceptance Before Any Production Cutover

Use a disposable WriterPackage in a disposable browser profile:

1. Edit `workshopText`, wait for verified `Uložené`, reload, and confirm the
   text survives.
2. Type again and immediately navigate; confirm the dirty warning.
3. Simulate a storage write failure; confirm the draft remains visible.
4. Change the same Package through Writer DB import in another tab; confirm the
   old editor reports conflict and writes nothing.
5. Save while typing more; confirm the late result does not erase newer text.
6. Verify unrelated Packages, Package notes, tombstones, legacy metadata, and
   Spark storage are byte/semantically unchanged as applicable.
7. Verify PC and mobile layout, keyboard focus, 200% zoom, and one-panel mobile
   behavior.
8. Verify the UI says Package changes are local-only and current Google sync
   remains Sparks-only.

## Implementation Slices

- **D1:** pure `workshopText` edit planner and artificial checks only.
- **D2:** injected existing-key persistence coordinator and in-memory storage
  checks only.
- **D3:** pure autosave state machine and artificial concurrency checks.
- **D4:** exact development-only edit mode with one editable `workshopText`
  surface.
- **D5:** disposable-profile manual acceptance and final isolation review.
- **D6:** separate docs decision for crash-recoverable Package drafts.
- **D7:** separate docs decision for local-only versus Package sync readiness.

D1-D7 must not be collapsed into one production change.

## Out Of Scope

This review does not implement or authorize:

- any source, runtime, React, CSS, entry, route, or build change;
- real storage reads or writes;
- a new storage key or draft schema;
- Package creation, ID generation, title editing, Spark editing, notes, or final
  text editing;
- adapted Spark editing or Spark-to-Package migration;
- Package deletion, tombstones, restore, archive, or Kôš;
- import/export, recovery, rollback, or persistence changes outside the future
  isolated D2 Package coordinator;
- Google Drive v2, Package sync, OAuth, network, or backend changes;
- production navigation or product-shell cutover;
- legacy Spark retirement, reset, purge, or R3;
- commit, push, deploy, or real author-data testing.

## Smallest Next Step

Implement D1 only: one pure deterministic `workshopText` edit planner with
artificial data and no React, storage, browser, time creation, Google, import,
or production wiring. Do not start D2 in the same commit.
