# Writer Legacy Spark Local Snapshot Review

R2.6.3 is a docs-only review for the future read-only local snapshot adapter.
It does not implement the adapter, does not read browser storage, does not read
real Writer data, and does not create backup files. The first implementation
commit after this review should still avoid real `localStorage` and should
start with a pure parser/model over synthetic raw strings.

## Storage Inventory

Authoritative local keys from the current source:

| Purpose | Key | Current reader | Current behavior |
| --- | --- | --- | --- |
| Legacy Sparks | `lassilab-writer:v0.1:sparks` | internal `readRawSparks()` in `src/storage.ts` | Missing, empty string, corrupt JSON, wrong top-level type, or invalid records collapse to `[]` or filtered arrays. |
| Writer Packages | `lassilab-writer:v0.1:packages` | `loadWriterPackages()` in `src/writerPackageStorage.ts` | Missing, empty string, corrupt JSON, wrong top-level type, or invalid records collapse to `[]` or filtered arrays. |
| New Spark draft | `lassilab-writer:v0.1:draft:new-spark` | `readNewSparkDraft()` in `src/storage.ts` | Missing, corrupt, invalid, or blank draft returns `undefined`. |

Raw Spark storage is a JSON array of `Spark` records:

```ts
type Spark = {
  id: string;
  title?: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  stage?: "spark" | "notes" | "workshop" | "final";
  temperature: "spark";
  tags: string[];
  schemaVersion: 1;
};
```

Raw Package storage is a JSON array of `WriterPackage` records. Package
tombstones and deleted notes are valid and must be preserved:

```ts
type WriterPackage = {
  id: string;
  title: string;
  sparkText: string;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
  }>;
  workshopText: string;
  finalText: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  packageVersion: 1;
  legacy?: { source: "spark"; stage?: "spark" | "notes" | "workshop" | "final" };
};
```

Raw draft storage is a JSON object:

```ts
type NewSparkDraft = {
  text: string;
  updatedAt: string;
  schemaVersion: 1;
};
```

## Loader Suitability

The existing product loaders are not suitable for R2.6.3 raw backup capture:

- `listSparks()` hides Spark tombstones and sorts visible Sparks.
- `loadWriterDbExportSparks()` returns all valid Sparks but uses
  `readRawSparks()`, which silently turns damaged storage into `[]` and filters
  invalid records.
- `loadWriterPackages()` silently turns damaged storage into `[]` and filters
  invalid records.
- `loadWriterPackageCatalog()` combines visible WriterPackages with adapted
  visible Sparks, so it is a product browsing view, not a backup source.
- `createManualWriterDbV2Export()` performs separate runtime loads and returns
  an object, not exact bytes from one captured raw snapshot.

R2.6.3 therefore needs a new read-only capture boundary. It should reuse pure
validators/builders where safe, but it must not reuse loaders that filter,
adapt, sort for UI, or hide corruption.

## Snapshot Contract

A local snapshot captures, in one synchronous window:

- raw Spark storage string or an explicit `missing` state;
- raw Package storage string or an explicit `missing` state;
- parsed and validated Sparks, including tombstones;
- parsed and validated WriterPackages, including Package tombstones and deleted
  notes;
- draft presence as text-free metadata only;
- one externally supplied canonical `createdAt`/`exportedAt`.

The snapshot must not write, repair, migrate, create Packages from Sparks,
filter tombstones, normalize timestamps, or call Drive. The result should be
deeply frozen. Public status summaries must expose only counts, key states,
reason codes, short hashes, and draft metadata; they must not expose raw strings
or parsed author text.

## Consistency Rule

R2.6.3 should synchronously read every local raw value at the beginning:

1. Read Spark raw value.
2. Read Package raw value.
3. Read draft raw value.
4. Parse and validate only those captured strings.
5. Build Writer DB v2 bytes only from those captured arrays.

No later local loader call may participate in the same snapshot. After the
future async Drive GET finishes, the guide should re-read only the raw Spark and
Package values and compare them with the captured raw strings or raw hashes. If
either changed, return `LOCAL_SNAPSHOT_CHANGED` and require a fresh assembly.

## Missing, Empty, Corrupt

R2.6.3 must distinguish these cases per key:

| Case | Spark key | Package key |
| --- | --- | --- |
| Missing key | Valid empty historical state because the current app loader explicitly treats missing as empty; record `missing` separately. | Valid pre-Package state; record `missing` separately. |
| Stored `[]` | Valid empty collection with raw bytes for `[]`. | Valid empty collection with raw bytes for `[]`. |
| Valid non-empty array | Valid only if every record validates and IDs are unique. | Valid only if every record validates and IDs are unique. |
| Stored empty string | Invalid/corrupt, because the key exists but is not JSON. | Invalid/corrupt, because the key exists but is not JSON. |
| Damaged JSON | Block with parse reason. | Block with parse reason. |
| Wrong top-level type | Block as invalid. | Block as invalid. |
| Invalid record shape | Block as invalid; do not filter. | Block as invalid; do not filter. |
| Duplicate IDs | Block with duplicate ID reason. | Block with duplicate ID reason. |

Damaged Spark or Package data blocks backup assembly. A missing key is not the
same as stored `[]`; both can produce empty arrays, but only stored `[]` has raw
storage bytes.

## Writer DB V2 Bytes

The snapshot should create Writer DB v2 bytes by:

1. Passing captured arrays to `createWriterDbV2Payload({ sparks, packages,
   exportedAt })`.
2. Revalidating the payload with the existing Writer DB v2 parser/verifier.
3. Serializing with the current browser download rule:
   `JSON.stringify(payload, null, 2)`.
4. Encoding that exact string through the published R2.6.2
   `encodeLegacySparkRetirementUtf8(text)` adapter.
5. Returning a copied `Uint8Array`.

This must not create a parallel Writer DB format. The current payload builder
preserves supplied array order, so R2.6.3 should preserve captured storage array
order for both collections. Deterministic Package semantic integrity remains
owned by the R2.4 baseline, which sorts Package IDs for the fingerprint.

## Current Packages And Raw Package Bytes

R2.6.3 must provide these R2.5 assembly dependencies from the same captured
snapshot:

- `createWriterDbV2BackupBytes()` returns the exact Writer DB v2 bytes above.
- `readCurrentWriterPackages()` returns a detached/frozen copy of the captured
  Package array.
- `readRawPackageStorageBytes()` returns UTF-8 bytes of the exact captured raw
  Package storage string, or `null` when the key was missing.

If Package storage contains `[]`, raw Package bytes are the bytes of the exact
two-character string `[]`. They are not bytes of `JSON.stringify(parsed)`.

## Draft Boundary

The new Spark draft is not part of Writer DB v1 or v2. R2.6.3 must never place
draft text in Writer DB backup bytes, manifests, logs, or public status.

Decision for the future adapter:

- valid non-empty draft present: block the backup guide as `incomplete` until
  the author saves or clears the draft, because the verified backup would not
  contain that unsaved text;
- blank or missing draft: no warning;
- corrupt or invalid draft key: block as a prerequisite issue because there may
  be unsaved author text that cannot be safely represented without exposing it.

The public summary may include only `draftPresent: true`, `draftUpdatedAt` if
valid, or typed draft reason codes.

## Proposed API

Prefer two layers:

```ts
captureLegacySparkRetirementLocalSnapshot(
  input,
  dependencies
)
```

Pure core dependencies:

```ts
type LocalSnapshotDependencies = {
  readStorageValue(key: string): string | null;
  encodeUtf8(text: string): Uint8Array;
};
```

The first implementation should use this API only with synthetic in-memory
`readStorageValue` values. A later thin browser adapter may bind
`readStorageValue` to `localStorage.getItem`, but the parser/builder must stay
testable without browser storage.

Suggested result shape:

```ts
type LocalSnapshotResult =
  | {
      status: "snapshot-captured";
      snapshot: LocalSnapshot;
      summary: TextFreeLocalSnapshotSummary;
    }
  | {
      status: "incomplete" | "invalid";
      reasons: readonly LocalSnapshotReason[];
    };
```

## Reason Codes

Minimum typed reason codes:

- `SPARK_STORAGE_READ_FAILED`
- `SPARK_STORAGE_PARSE_FAILED`
- `SPARK_STORAGE_INVALID`
- `PACKAGE_STORAGE_READ_FAILED`
- `PACKAGE_STORAGE_PARSE_FAILED`
- `PACKAGE_STORAGE_INVALID`
- `DUPLICATE_SPARK_ID`
- `DUPLICATE_PACKAGE_ID`
- `LOCAL_SNAPSHOT_CHANGED`
- `WRITER_DB_EXPORT_FAILED`
- `UTF8_ENCODE_FAILED`
- `DRAFT_STORAGE_PARSE_FAILED`
- `DRAFT_STORAGE_INVALID`
- `DRAFT_PRESENT`

Reason codes must never include author text, raw JSON, key values, exception
messages, file names, account data, or tokens.

## Privacy And Side Effects

R2.6.3 will be the first reviewed R2 step that can read real local author data,
but only in the later thin browser adapter. The contract:

- local read-only storage access only;
- no server, network, or Drive call;
- no logs of raw strings, parsed records, or draft text;
- no storage write, repair, migration, tombstone, reset, or delete;
- no Blob, File, download, manifest, or artifact creation;
- snapshot values exist only in memory;
- public UI/status receives only text-free summaries.

## Synthetic Test Plan

Cover at least:

- both storage keys missing;
- valid empty collections;
- live Sparks;
- Spark tombstones;
- live Packages;
- Package tombstones;
- deleted notes;
- damaged Spark JSON;
- damaged Package JSON;
- wrong top-level type;
- invalid Spark record;
- invalid Package record;
- duplicate Spark ID;
- duplicate Package ID;
- exact raw Package bytes;
- `[]` versus missing key;
- Writer DB v2 counts;
- same explicit `exportedAt`;
- stable Writer DB bytes;
- raw input strings are not mutated;
- snapshot and summaries are frozen;
- no author text in public summary;
- valid draft blocks without draft text;
- corrupt draft blocks without draft text;
- local snapshot changed detection;
- no `setItem`, `removeItem`, or `clear`;
- no Drive, network, Blob, File, or download API.

## Implementation Slices

R2.6.3a: pure raw storage parser and snapshot model over synthetic strings.
This can be the first implementation commit and should still avoid real
`localStorage`.

R2.6.3b: Writer DB v2 exact-bytes builder over the captured snapshot, using the
R2.6.2 UTF-8 adapter and existing Writer DB payload builder.

R2.6.3c: thin browser `localStorage.getItem` adapter. This is the first step
that may read real local author data and should remain separate.

R2.6.3d: post-Drive local snapshot consistency checker that re-reads only raw
local values and reports `LOCAL_SNAPSHOT_CHANGED`.

R2.6.3a and R2.6.3b may be combined only if the diff remains pure, synthetic,
and free of browser storage. R2.6.3c must stay separate because it is the first
real `localStorage.getItem` step.

## Smallest Next Step

R2.6.3a is published at `fc741821a49a957b85d1f3fc9a0c4d72d6f9faa3` in
`src/legacySparkRetirementLocalSnapshot.ts`. It is a pure parser/model over
explicit synthetic raw strings, uses typed reasons and frozen detached results,
distinguishes missing from stored `[]`, preserves tombstones/deleted notes, and
returns only text-free public summary metadata. It reads no localStorage and
creates no Writer DB bytes. R2.6.3b is published at
`389b6347ec84d5472aa62a86d11fdff3416fed6d` in
`src/legacySparkRetirementWriterDbBytesBuilder.ts`: it reuses the existing v2
payload builder, serializes with two-space JSON, self-verifies through R2.2,
and keeps injected UTF-8 bytes behind a fresh-copy accessor. It reads no
storage, hashes nothing, and creates no file/download. R2.6.3c is specified in
`WRITER_LEGACY_SPARK_LOCAL_STORAGE_READER_REVIEW.md`. Pure c1 is published at
`9d8168e1237d16eea0cbd06de0d923142f7de8cf`: it injects `readStorageValue`,
captures Spark -> Package -> Draft once each, fails without partial snapshot,
and delegates to this parser. The docs-only c2 review keeps c2a import-safe and
unwired; c2b is the first actual real-data `localStorage.getItem` invocation.
