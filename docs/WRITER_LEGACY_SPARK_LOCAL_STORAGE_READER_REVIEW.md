# Writer Legacy Spark Local Storage Reader Review

R2.6.3c is a docs-only review. It performs no storage read, uses no real author
data, changes no runtime, and creates no backup artifact.

## Storage API Inventory

| Value | Exact key | Current reader | Suitability |
| --- | --- | --- | --- |
| Sparks | `lassilab-writer:v0.1:sparks` | private `STORAGE_KEY`, `readRawSparks()` / `loadWriterDbExportSparks()` in `src/storage.ts` | Unsuitable: parsing can collapse or filter damaged data. |
| Packages | `lassilab-writer:v0.1:packages` | exported `WRITER_PACKAGE_STORAGE_KEY`, `loadWriterPackages()` in `src/writerPackageStorage.ts` | Unsuitable: parsing filters invalid records. |
| Draft | `lassilab-writer:v0.1:draft:new-spark` | private `NEW_SPARK_DRAFT_STORAGE_KEY`, `readNewSparkDraft()` in `src/storage.ts` | Unsuitable: missing, damaged, invalid, and blank states collapse. |

The retirement path needs exact raw strings and explicit missing states. It
must not use product loaders, catalogs, export helpers, or Drive sync. A future
reader should own one frozen three-key contract instead of changing existing
product storage visibility or behavior merely to reuse constants.

## R2.6.3c1: Pure Injected Coordinator

The smallest safe implementation is tested only with synthetic in-memory data:

```ts
type LegacySparkRetirementStorageKeys = Readonly<{
  sparks: "lassilab-writer:v0.1:sparks";
  packages: "lassilab-writer:v0.1:packages";
  draft: "lassilab-writer:v0.1:draft:new-spark";
}>;

type LegacySparkRetirementStorageReader = Readonly<{
  getItem(key: string): string | null;
}>;

captureLegacySparkRetirementLocalStorageSnapshot(input: Readonly<{
  createdAt: string;
  keys: LegacySparkRetirementStorageKeys;
  storage: LegacySparkRetirementStorageReader;
}>): LegacySparkRetirementLocalSnapshotResult;
```

c1 receives only an injected object. It must not reference `window`, browser
storage globals, `document`, Drive, network, filesystem, Blob, File, or download
APIs. It delegates captured values and explicit `createdAt` to
`captureLegacySparkRetirementLocalSnapshotFromRaw()` and duplicates no parsing.

## R2.6.3c2: Thin Browser Wrapper

Only a later, separately approved c2 wrapper may bind c1 to
`window.localStorage.getItem`. c2 is the first implementation that may read
real local author data. It must add no `setItem`, `removeItem`, `clear`, storage
events, retries, repair, migration, logging, UI wiring, or assembly. c1 and c2
should be separate commits and reviews.

## Fixed Synchronous Read Protocol

One attempt performs exactly three reads, exactly once each, before parsing:

1. Spark key.
2. Package key.
3. Draft key.

Each result is first retained in a local variable. The coordinator must not
parse between reads, call a product loader, reread a key, enumerate storage, or
accept a partial snapshot. After all reads succeed, `null` maps to
`{ status: "missing" }`; every string, including `""`, maps unchanged to
`{ status: "present", raw }`. No trimming, parsing, normalization, filtering,
sorting, repair, or reserialization belongs in the reader. R2.6.3a owns those
captured strings and distinguishes missing from stored `[]` and invalid `""`.

## Read Failures And Missing Values

Catch each `getItem` call separately and return one frozen text-free reason:

- Spark throws: `SPARK_STORAGE_READ_FAILED`.
- Package throws: `PACKAGE_STORAGE_READ_FAILED`.
- Draft throws: `DRAFT_STORAGE_READ_FAILED`.

Stop immediately at the failed key. Do not read later keys, expose earlier raw
values, or call R2.6.3a/R2.6.3b. Never return or log exception messages, keys,
raw values, author records, or draft text. Missing is not a failure.
`DRAFT_STORAGE_READ_FAILED` enters the shared runtime union only with c1; this
review changes no runtime type.

## Explicit Time And Pipeline

`createdAt` is mandatory input from a higher reviewed coordinator. The reader
must not call `Date.now()`, construct `new Date()`, infer record time, or use a
fallback clock. R2.6.3a validates it; R2.6.3b uses the same value as
`exportedAt`.

```text
explicit createdAt + injected getItem
  -> c1 captures three raw values
  -> R2.6.3a parses, validates, freezes, and summarizes
  -> optional R2.6.3b creates and self-verifies exact Writer DB v2 bytes
  -> later R2.5 assembly receives copied bytes and captured Packages
```

c1 returns the existing R2.6.3a result. R2.6.3b runs only for
`snapshot-captured`, never after a read, parse, validation, or draft failure.

## R2.6.3c / R2.6.3d Boundary

c owns only the initial three-value capture. It does not wait for Drive or
claim storage stayed unchanged. Separate R2.6.3d may, after an async Drive
read, reread only Spark and Package, compare exact raw states/bytes, and return
`LOCAL_SNAPSHOT_CHANGED`. Draft reread policy remains separately reviewable.
Neither c nor d authorizes backup verification, download, deletion, reset,
tombstones, persistence, or R3.

## Privacy And In-Memory Lifetime

Raw strings and parsed records may live only in local variables and the defined
in-memory snapshot during one user-initiated attempt. They must not enter logs,
telemetry, errors, manifests, UI/React state, clipboard, URLs, filenames,
storage, network, or Drive. Public results expose only frozen typed
statuses/reasons and existing text-free summary fields.

The future runtime owner releases references when the attempt succeeds, fails,
is cancelled, or is superseded. No module cache, singleton, background/page-load
capture, storage listener, or persistence is allowed. JavaScript cannot promise
immediate erasure; the contract minimizes lifetime and retained references.

## Synthetic Test Plan

c1 must prove exact Spark -> Package -> Draft order and one call per key; all
reads before parsing; exact forwarding of `string | null`; distinct missing,
`[]`, `""`, and non-empty values; fail-fast typed read errors; explicit time;
equivalence to direct R2.6.3a; optional R2.6.3b only after success; immutability;
no author text or exception leakage; and no browser global, write, Drive,
network, file, Blob, download, log, or timer access.

c2 needs its own narrow delegation/write-absence checks. Real-data testing is
not part of c1 and requires separate explicit approval for c2.

## Decision

Implement R2.6.3c1 first as a pure injected synchronous coordinator with
synthetic tests. Do not combine it with c2. The first actual `localStorage`
read belongs only to the later R2.6.3c2 browser wrapper after separate review
and explicit approval.
