# WriterPackage Workshop Persistence Review

## Status And Scope

This review defines D2 for persisting one D1 `workshopText` edit to the existing
WriterPackage collection. The published foundation is:

- Phase D contract: `f780e27627ee82e3a35fac891c99d0e2f60dd911`;
- D1 pure planner: `362a0de3136dbeabe5864f7d5122fb30d61735f8`.

D2a now adds only the pure TypeScript codec and artificial checks defined below.
It adds no React, CSS, storage read or write, storage key, browser adapter,
timer, Google Drive behavior, import/export behavior, recovery behavior, route,
or navigation. It does not authorize a deployment and does not read or log real
author data.

The planned D2 foundation remains isolated and synthetic/injected. It does not
authorize autosave, a text editor, production wiring, or a second active
Package writer.

## Existing Boundaries

### D1

`planWriterPackageWorkshopEdit()` already:

- validates one explicit WriterPackage collection;
- blocks duplicate Package IDs;
- requires an exact selected ID and `expectedUpdatedAt` revision;
- blocks tombstoned Packages;
- changes only `workshopText` and top-level `updatedAt`;
- returns `unchanged` without advancing time;
- returns detached and frozen output;
- uses injected `now` and performs no storage access.

D2 must call this planner. It must not reproduce merge or edit semantics.

### Current WriterPackage helpers

The production helpers in `writerPackageStorage.ts` are not a safe D2 write
boundary:

- `loadWriterPackages()` returns `[]` for missing, malformed, or non-array raw
  data and filters invalid records;
- `saveWriterPackages()` writes the complete collection without read-back;
- `upsertWriterPackage()` re-reads through the filtering loader, has no
  expected-revision check, and performs no verification or rollback.

D2 must not call these helpers. Filtering damaged records before a complete
collection write could silently discard author data.

### Writer DB import persistence

`writerDbPersistence.ts` supplies useful safety principles but is intentionally
too broad to reuse directly. It owns a four-key import transaction, backup,
marker, Sparks write, Packages write, rollback, and marker cleanup.

D2 changes only one existing Package collection key. It must not create an
import backup, reuse the import transaction marker, touch Sparks, or call
`persistWriterDbImport()`.

## Decision

Split D2 into two separately reviewed implementation commits:

- **D2a:** pure strict WriterPackage collection codec and shared validation;
- **D2b:** synchronous injected single-key persistence coordinator and an
  in-memory fault-injection harness.

D2a must be published before D2b. D2b must remain unwired after publication.
D3 autosave state and all React/browser composition remain later phases.

This split avoids duplicating Package validation inside the persistence
coordinator and keeps the first next change write-free.

## D2a Pure Strict Collection Codec

D2a moves the former private D1 Package/note/legacy compatibility validation
and clone rules into one pure shared module. D1 reuses those compatibility
functions without changing its published behavior. The strict raw parser adds
the canonical-shape/unknown-key check only at its own storage boundary.

Recommended responsibilities:

```ts
parseWriterPackageCollectionJsonStrict(raw: string)
cloneAndFreezeWriterPackageCollection(packages)
serializeWriterPackageCollection(packages)
```

The exact API names may follow repository conventions, but the contract is:

1. Input is an explicit string or explicit collection, never storage.
2. Malformed JSON is distinct from a valid non-array value.
3. Every Package, note, timestamp, tombstone, `packageVersion`, and optional
   `legacy` value is validated.
4. Duplicate Package IDs block the entire collection.
5. Unsupported `packageVersion` or unknown Package/note/legacy keys block the
   collection instead of being discarded.
6. No record is filtered, repaired, sorted, deduplicated, or migrated.
7. Package order and note order remain exact.
8. Empty strings remain valid content.
9. Output is deeply detached and frozen.
10. Serialization is deterministic for the supplied validated collection.

Stable parse reasons should distinguish at least:

- `malformed-json`;
- `package-storage-not-array`;
- `unsupported-package-shape`;
- `unsupported-package-version`;
- `invalid-package`;
- `duplicate-package-id`.

Parse failures must not contain raw JSON, Package IDs, titles, note IDs, or
author text. Successful parsed collections stay inside the private coordinator
boundary. Tests use artificial content only.

D2a imports no React, storage module, browser global, clock, timer, randomness,
network, Google Drive, import/export, persistence, recovery, or logging API.

## D2b Injected Single-Key Coordinator

The future D2b coordinator receives all effects explicitly:

```ts
type WriterPackageWorkshopStorage = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

type PersistWriterPackageWorkshopEditInput = Readonly<{
  storage: WriterPackageWorkshopStorage;
  key: string;
  packageId: string;
  expectedUpdatedAt: string;
  workshopText: string;
  now: string;
}>;
```

Production composition, if later approved, may inject only the existing key:

```text
lassilab-writer:v0.1:packages
```

D2b introduces no constant or new storage key. Synthetic checks may use an
artificial injected key. The coordinator calls no direct `window.localStorage`
and its storage interface intentionally has no `removeItem`.

## Required Success Sequence

1. Validate that the injected key is non-empty.
2. Call `getItem(key)` once to capture the current exact raw value.
3. A thrown read becomes a typed pre-write failure.
4. A missing value becomes `blocked/package-storage-missing`; editing cannot
   create the first Package collection.
5. Parse the complete raw value through D2a without filtering.
6. Call D1 once with that exact parsed collection and the supplied editor
   revision, text, and time.
7. Map D1 `stale-revision` to `conflict`; no write is allowed.
8. Return D1 `unchanged` or other blocked reasons without `setItem`.
9. Serialize the complete D1 ready collection in memory.
10. Call `setItem(key, plannedRaw)` once.
11. Read the same key back.
12. Require exact raw equality with `plannedRaw`, strict D2a parsing, and
    complete semantic equality with the planned collection.
13. Return `saved` only after all three verifications pass.

No success result may be inferred from `setItem` returning normally.

## Typed Results

D2b returns exactly one of:

- `saved` — verified updated Package plus previous and next revision;
- `unchanged` — detached Package and zero writes;
- `conflict` — stale expected revision and zero writes;
- `blocked` — stable input/storage reason and zero writes;
- `failed` — stable failure stage and truthful storage/rollback facts.

Recommended failed fields:

```ts
type WriterPackageWorkshopPersistenceFailure = Readonly<{
  status: "failed";
  stage: "current-read" | "serialize" | "write" | "read-back" | "verify";
  writeAttempted: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  storageState: "not-written" | "previous-verified" | "unknown";
  rollbackStage?: "inspect" | "write" | "verify";
}>;
```

Successful and unchanged results may carry a detached WriterPackage for the
private controller; it must never be logged or rendered wholesale. Failure,
blocked, and conflict metadata remain text-free. Exception messages, raw JSON,
Package IDs, titles, note IDs, and author text must not leave the private
coordinator boundary. Explicit previous/next revision timestamps are allowed
only in their typed success/conflict fields. Stable reason codes own the UI
mapping later.

## Conditional Exact-Raw Rollback

`setItem` throwing does not prove that storage remained unchanged. Conversely,
blindly restoring the previous raw value can overwrite a legitimate concurrent
write from another tab. D2b therefore needs a conditional rollback protocol.

After any write attempt that cannot be verified:

1. Inspect the current raw key when possible.
2. If it already equals `previousRaw`, report `previous-verified`; no rollback
   write is needed.
3. If it exactly equals `plannedRaw`, the coordinator may restore the exact
   `previousRaw`, then read it back and require byte-for-byte equality.
4. If it is missing or differs from both values, do not overwrite it. Report
   `storageState: "unknown"`; it may belong to another writer.
5. If inspection throws, do not perform a blind rollback.
6. A rollback `setItem` throw is followed by one verification read when
   possible, because the write may still have occurred.
7. `rollbackSucceeded` is true only when a rollback write was attempted and
   exact `previousRaw` is then read back. If the previous raw was already
   present, use `storageState: "previous-verified"` with no rollback attempt.

The exact previous raw string stays closure-local for the duration of one call.
It is never returned, logged, hashed, copied to another key, or persisted as a
new backup.

## Concurrency Limit

Injected synchronous compare-then-write is not an atomic compare-and-set across
browser tabs. D2 detects any revision visible at its initial read and avoids a
blind rollback over an unexpected value, but it cannot eliminate the final
race between comparison and `setItem`.

Therefore:

- D2b remains synthetic and unwired;
- D3 must not claim cross-tab atomicity;
- development UI requires a separate single-writer or browser-lock decision;
- production autosave remains **NO-GO** until concurrency and draft recovery
  are explicitly resolved.

The existing Writer DB import transaction marker must not be reused as a
Package editing lock.

## D2a Test Plan

- missing input is handled by D2b, not invented as an empty collection;
- malformed JSON and valid non-array JSON remain distinct;
- empty array is valid;
- valid Packages preserve all fields, order, notes, tombstones, and legacy
  metadata;
- unsupported version and unknown keys block;
- one invalid Package or note blocks the whole collection;
- duplicate Package IDs block;
- no record is filtered or repaired;
- input and parsed values are not mutated;
- output is deeply detached and frozen;
- equivalent inputs produce equivalent results;
- no browser, storage, time, randomness, network, React, or author data enters
  the checks;
- existing D1 19/19 behavior remains unchanged after shared-validator reuse.

## D2b Test Plan

- initial read throw returns pre-write failure and zero writes;
- missing key blocks and performs zero writes;
- malformed, non-array, unsupported, invalid, or duplicate collection blocks
  and performs zero writes;
- stale revision returns `conflict` and performs zero writes;
- missing/deleted Package and invalid time block with zero writes;
- unchanged text performs zero writes;
- ready edit touches only the injected key;
- operation order is current read, one planned write, then read-back;
- success requires exact raw, strict parse, and full semantic verification;
- a normal write failure is never assumed safe without inspection;
- previous raw already present is verified without another write;
- planned raw observed after a thrown write is restored exactly;
- an unexpected third raw value is never overwritten;
- failed rollback write still receives a final exact verification read;
- failed rollback verification reports `unknown` and never `saved`;
- raw whitespace and property order are restored exactly when rollback succeeds;
- unrelated Packages and all nested data remain unchanged;
- the coordinator never touches Sparks, draft, backup, import marker, Google
  preferences, or any second key;
- no `removeItem`, real localStorage, React, timer, network, Google Drive,
  import/export, recovery, or logging dependency exists;
- no raw JSON or author content appears in failure/blocked/conflict metadata,
  logs, snapshots, or errors; success fixtures remain artificial.

## Out Of Scope

D2 does not implement or authorize:

- React, editor UI, debounce, autosave state, unload warnings, or navigation;
- direct production localStorage wiring;
- `loadWriterPackages()`, `saveWriterPackages()`, or
  `upsertWriterPackage()` changes;
- Writer DB import persistence reuse or marker creation;
- a Package backup key, draft key, lock key, or transaction key;
- Package creation, deletion, restore, migration, or per-note editing;
- Google Drive v2 or Package synchronization;
- D3, D4, production cutover, deployment, or real author-data testing.

## Smallest Next Step

Complete the final safety review and publish D2a as its own write-free commit.
Do not add the injected D2b storage coordinator, D3 autosave state, or any UI or
production composition in that commit.
