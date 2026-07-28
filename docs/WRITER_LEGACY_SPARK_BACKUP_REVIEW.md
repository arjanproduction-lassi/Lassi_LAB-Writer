# Writer Legacy Spark Backup Review

## Status And Scope

This document defines the R2 safety contract for creating and verifying backups
before any legacy Spark retirement operation. It is based on published R1 at
`ee9b31d7c02274192b0ac9a45abd5da8074deec2`.

This review is documentation only. It does not read real user data, create a
backup file, download Google Drive content, calculate a hash over real content,
write storage, create a tombstone, reset data, implement rollback, add UI,
commit, push, or deploy.

The phase boundary is strict:

```text
R1: ready-for-backup
R2: backup-verified
R3 or later: ready-to-create-tombstones
```

R2 must never report `ready-to-delete`, `ready-to-purge`, or `completed`.
A verified backup proves only that usable safety artifacts exist.

## Current R1 Boundary

The published R1 kernel:

- accepts explicitly supplied typed Spark sources and WriterPackages;
- identifies local-device, Google Drive, and imported-backup sources;
- computes deterministic union IDs and maximum observed `updatedAt` values;
- counts live Sparks, Spark tombstones, and WriterPackages;
- records only `draftPresent`, never draft text;
- blocks duplicate source IDs, duplicate Spark IDs within one source, and
  duplicate Package IDs;
- returns frozen text-free metadata with status `ready-for-backup`;
- has no loader, storage, network, file, hash, backup, tombstone, or UI surface.

R2 consumes a frozen R1 result. It must not reinterpret R1 as permission to
delete or write anything.

## Evidence From The Current Code

The review is grounded in:

- `src/writerDb.ts`
- `src/writerDbExport.ts`
- `src/writerDbImportRuntime.ts`
- `src/writerDbImportCoordinator.ts`
- `src/writerDbPersistence.ts`
- `src/writerDbRecovery.ts`
- `src/storage.ts`
- `src/writerPackageStorage.ts`
- `src/googleDriveSync.ts`
- `src/legacySparkRetirementInventory.ts`
- the current production export handlers in `src/App.tsx`

### Current Writer DB v2 export

`createManualWriterDbV2Export()` calls:

1. `loadWriterDbExportSparks()`;
2. `loadWriterPackages()`;
3. `createWriterDbV2Payload()`.

The returned v2 envelope contains `app`, `schemaVersion: 2`, `exportedAt`,
`sparkCount`, `packageCount`, `sparks`, and `packages`. The production handler
passes that object through `parseWriterDbPayload()`, serializes it using
`JSON.stringify(value, null, 2)`, and downloads a Blob.

For valid stored records:

- `loadWriterDbExportSparks()` includes live Sparks and Spark tombstones;
- `loadWriterPackages()` includes live Packages and Package tombstones;
- Package notes remain inside their Package, including deleted notes;
- all Package text layers, timestamps, `packageVersion`, and legacy metadata
  remain present.

However, both loaders filter invalid records. Missing, malformed, or wholly
invalid Package storage can collapse to `[]`; invalid Spark entries are also
filtered. Therefore the current manual v2 export is useful but is not by itself
a corruption-complete retirement backup. R2 must validate the raw collections
before allowing this export path to become authoritative.

`createWriterDbV2Payload()` copies the two arrays but not every nested object.
Immediate serialization captures their current values, but a future pure R2
artifact builder should produce detached data or serialize within one guarded
operation before any caller can mutate the inputs.

### Count authority

The record arrays are authoritative for content and actual counts.
`sparkCount` and `packageCount` are declared metadata.

`parseWriterDbPayload()` requires each declared count to be a non-negative
integer, but it does not require equality with the array length. Count mismatch
is currently a preview warning. R2 backup verification is stricter: both
declared counts must equal their corresponding array lengths or the artifact is
invalid for retirement backup purposes.

### Current v1/v2 import and rollback limitation

Both import schemas use merge semantics. Missing incoming records never delete
local records. For an ID present on both sides, only a strictly newer
`updatedAt` replaces the current record. Equal or older incoming records keep
the current local value. V1 leaves WriterPackages untouched; v2 merges whole
top-level Packages by their top-level `updatedAt` and does not merge notes
individually.

Consequently, importing a pre-retirement v2 backup after R3 has created newer
tombstones may keep those tombstones. Ordinary import is not a proven rollback.

### Existing backup helpers

`createWriterDbImportBackup()` is pure. It validates schema version, optional
time, every Spark and WriterPackage, Package version, and same-collection ID
uniqueness. It returns detached Sparks and Packages, including tombstones,
tags, Package layers, notes, deleted notes, and legacy metadata. Its output is
an internal `WriterDbImportBackup` journal shape, not a downloadable Writer DB
v2 envelope and not the R2 manifest.

`persistWriterDbImport()` is not pure. It writes and read-back verifies the
unified import backup, transaction marker, Sparks, and WriterPackages through
an injected writable storage interface. It also owns import rollback. R2 must
not call it.

The legacy `backupSparks()` path in `src/storage.ts` writes Spark-only backups
before legacy import or Drive sync. It omits WriterPackages and is not an R2
retirement backup.

`inspectWriterDbRecovery()` is read-only, but it inspects the internal import
journal. It does not create or verify downloadable R2 artifacts.

### Current Google Drive v1 read path

The canonical hidden file is:

```text
lassilab-writer-db-v001.json
```

It is Writer DB schema v1 and contains Sparks only. Current
`downloadRemoteDbFile()` is private to `googleDriveSync.ts` and calls
`driveJsonRequest()`, which returns `response.json()`. The original response
bytes and raw textual representation are discarded.

There is no public raw Drive export/download API. More importantly,
`syncGoogleDrive()` immediately merges the parsed remote DB into local Spark
storage and then uploads the merged result. It is not a read-only R2 source.
If the remote file is missing, sync creates one, which is also forbidden in R2.

A future R2 adapter therefore needs a separate read-only Drive operation that:

- finds the existing canonical file without creating one;
- reads `response.arrayBuffer()` or an equivalent exact-byte result;
- keeps those bytes unchanged for download and raw SHA-256;
- separately decodes a validation copy as UTF-8 JSON;
- never calls merge, upload, PATCH, POST, or local storage persistence.

## Mandatory R2 Artifacts

One R2 backup set contains two data artifacts and one text-free manifest.
All three use the same injected UTC `createdAt` and filename timestamp.

### A. Writer DB v2 backup

Required content:

- `app: "LassiLAB Writer"`;
- `schemaVersion: 2`;
- canonical ISO `exportedAt`;
- complete `sparks` array;
- complete `packages` array;
- `sparkCount === sparks.length`;
- `packageCount === packages.length`;
- every live record and tombstone;
- all creation, update, and deletion timestamps;
- all Package titles, layers, notes, deleted notes, `packageVersion`, and legacy
  metadata.

The artifact should use UTF-8 without BOM, two-space JSON indentation, and one
final LF. These serialization choices are part of its raw-hash contract.

R2 must build it only from raw-validated collections. It must not rely on a
filtering loader result to prove completeness.

### B. Raw Google Drive v1 backup

When the canonical Drive file exists, preserve its exact downloaded bytes
without parse/stringify, whitespace normalization, key reordering, merge, or
rewrite. Parsing happens only against a separate decoded copy.

If Drive is declared in scope but the file is missing, report
`drive-source-missing` and keep the overall result `incomplete`. Do not create a
replacement file.

If R1 and explicit configuration evidence establish that Drive was never in
scope for this retirement set, record `drive-backup-not-applicable`. This may
participate in a verified set, but it must remain visible in the manifest.

### C. Backup manifest

The manifest is mandatory. It contains metadata and hashes, never creative
text, OAuth data, Drive file ID, email, access token, or browser profile path.

Minimum contract:

```ts
type Sha256Hex = string;

type LegacySparkRetirementBackupManifest = Readonly<{
  backupVersion: 1;
  purpose: "legacy-spark-retirement-r2";
  createdAt: string;
  verificationStatus: "backup-verified";
  sources: readonly Readonly<{
    sourceId: string;
    sourceKind: "local-device" | "google-drive" | "imported-backup";
  }>[];
  writerDbV2: Readonly<{
    fileName: string;
    mediaType: "application/json";
    byteLength: number;
    rawSha256: Sha256Hex;
    schemaVersion: 2;
    sparkCount: number;
    packageCount: number;
    liveSparkCount: number;
    sparkTombstoneCount: number;
    livePackageCount: number;
    packageTombstoneCount: number;
    sparkSemanticSha256: Sha256Hex;
  }>;
  driveV1:
    | Readonly<{
        status: "verified";
        fileName: string;
        mediaType: "application/json";
        byteLength: number;
        rawSha256: Sha256Hex;
        schemaVersion: 1;
        sparkCount: number;
        liveSparkCount: number;
        tombstoneCount: number;
      }>
    | Readonly<{
        status: "drive-backup-not-applicable";
      }>;
  packageBaseline: LegacySparkRetirementPackageBaseline;
}>;

type LegacySparkRetirementPackageBaseline = Readonly<{
  packageCount: number;
  livePackageCount: number;
  packageTombstoneCount: number;
  noteCount: number;
  deletedNoteCount: number;
  orderedPackageIds: readonly string[];
  semanticSha256: Sha256Hex;
  rawStorageSha256?: Sha256Hex;
}>;
```

`Sha256Hex` must be validated as exactly 64 lowercase hexadecimal characters.
The manifest hashes the two data artifacts, not itself; a manifest self-hash
would be circular. An external checksum file can be designed separately.

## Stable File Names

Use one injected UTC timestamp formatted with ASCII characters and no colons:

```text
LassiLAB_Writer_pre-retirement_DBv2_YYYY-MM-DD_HH-mm-ssZ.json
LassiLAB_Writer_pre-retirement_DriveV1_YYYY-MM-DD_HH-mm-ssZ.json
LassiLAB_Writer_pre-retirement_manifest_YYYY-MM-DD_HH-mm-ssZ.json
```

Rules:

- all files in one set share the exact timestamp;
- `Z` means UTC;
- names contain no title, Spark text, Package text, email, device name, or ID;
- only ASCII letters, digits, `_`, `-`, and `.` are used;
- names are valid on Windows, Android, and common filesystems;
- collision handling must request a new injected timestamp or explicit user
  choice, never silently overwrite an existing backup.

## Hash And Fingerprint Contract

### Raw SHA-256

Calculate standard SHA-256 over the exact bytes downloaded to each data file.
Use an injected platform cryptography implementation such as Web Crypto; do not
invent a hash algorithm.

Any byte change, including whitespace, key order, newline style, or final LF,
changes the raw hash. Verification recalculates the hash from the downloaded
file bytes and compares it with the manifest.

For localStorage Package evidence, `rawStorageSha256` means SHA-256 over the
UTF-8 encoding of the exact string returned by the injected `getItem` call.
It is absent when raw Package storage was not safely available. Its absence is
not silently replaced by a hash of a normalized Package array.

### Semantic Package fingerprint

The semantic Package fingerprint is mandatory and protects the Package model
through R3-R6.

Canonicalization rules:

1. validate all Packages and reject duplicate Package IDs;
2. sort top-level Packages by ID using an explicit code-unit comparator;
3. emit object fields in this fixed order: `id`, `title`, `sparkText`, `notes`,
   `workshopText`, `finalText`, `createdAt`, `updatedAt`, optional `deletedAt`,
   `packageVersion`, optional `legacy`;
4. preserve note order exactly;
5. emit note fields in fixed order: `id`, `text`, `createdAt`, `updatedAt`,
   optional `deletedAt`;
6. emit legacy fields in fixed order: `source`, optional `stage`;
7. distinguish an omitted optional field from a present field; never add
   defaults during fingerprinting;
8. UTF-8 encode the canonical JSON and apply standard SHA-256.

Creative text participates in the hash input but never appears in the manifest,
logs, reason codes, snapshots, or test output.

### Semantic Spark fingerprint

A semantic Spark fingerprint is also recommended and is part of the minimum
manifest above. The raw v2 hash proves exact artifact integrity; the Spark
fingerprint additionally proves semantic equality if a later tool must compare
different JSON formatting. Canonicalize Sparks by ID with fixed field order and
preserve tag order. Reject duplicate IDs before hashing.

## Writer DB v2 Verification

Verification receives the exact artifact bytes, expected raw hash, expected R1
metadata, and expected Package baseline. It is read-only and immutable.

Required checks:

1. raw SHA-256 matches;
2. bytes decode as UTF-8 and JSON parses;
3. `app === "LassiLAB Writer"`;
4. `schemaVersion === 2`;
5. `exportedAt` is valid and matches the backup-set time contract;
6. `sparks` and `packages` are arrays of valid records;
7. `sparkCount === sparks.length`;
8. `packageCount === packages.length`;
9. Spark IDs are unique and Package IDs are unique within their collections;
10. live/tombstone counts match the R1/manifest expectations;
11. timestamps and tombstones survive unchanged;
12. Package semantic fingerprint equals the baseline;
13. Spark semantic fingerprint equals the manifest;
14. the artifact can be parsed again by `parseWriterDbJson()`;
15. no input or parsed record is mutated.

The existing parser is reused for record and envelope validation, but R2 adds
strict count equality and duplicate-ID checks because the parser alone does not
enforce them.

## Raw Drive v1 Verification

Required checks when Drive is in scope:

1. exact raw bytes remain available and their SHA-256 matches;
2. validation uses a decoded copy, never a normalized replacement artifact;
3. JSON parses;
4. `app === "LassiLAB Writer"` and `schemaVersion === 1`;
5. `sparks` exists and every entry is a valid Spark;
6. `sparkCount` is a non-negative integer and equals `sparks.length`;
7. Spark IDs are unique;
8. all live records, tombstones, and timestamps remain present;
9. no merge, local persistence, remote upload, or canonical-file creation was
   called;
10. token, Drive file ID, response headers, email, and private source labels do
    not enter either artifact or manifest.

Drive outcomes:

- existing and valid raw file: `verified`;
- Drive in scope but canonical file absent: `drive-source-missing`, overall
  result `incomplete`;
- Drive provably outside scope: `drive-backup-not-applicable`;
- unreadable or invalid raw file: overall result `invalid`.

## WriterPackage Protection Baseline

R2 must not change Packages. It records:

- total Package count;
- live and tombstoned Package counts;
- sorted Package IDs;
- total note count including deleted notes;
- deleted-note count;
- semantic Package SHA-256;
- exact raw Package storage text SHA-256 when available safely.

An empty, valid Package array is a valid zero baseline. Missing, malformed,
partially invalid, or ambiguously filtered Package storage blocks verification;
`loadWriterPackages() === []` alone does not prove a valid empty collection.

The baseline is compared after every future R3-R6 step. Any changed count, ID,
timestamp, Package version, title, text layer, note/order, deletion flag, or
legacy field stops the retirement process.

## Typed Verification Result

```ts
type LegacySparkRetirementBackupReasonCode =
  | "WRITER_DB_BACKUP_MISSING"
  | "WRITER_DB_PARSE_FAILED"
  | "WRITER_DB_SCHEMA_MISMATCH"
  | "WRITER_DB_COUNT_MISMATCH"
  | "DRIVE_BACKUP_MISSING"
  | "DRIVE_PARSE_FAILED"
  | "DRIVE_SCHEMA_MISMATCH"
  | "DRIVE_COUNT_MISMATCH"
  | "DRIVE_RAW_NOT_PRESERVED"
  | "HASH_MISMATCH"
  | "PACKAGE_DATA_INVALID"
  | "PACKAGE_BASELINE_MISMATCH"
  | "DUPLICATE_SPARK_ID"
  | "DUPLICATE_PACKAGE_ID"
  | "TOMBSTONE_COUNT_MISMATCH"
  | "ARTIFACT_RELOAD_FAILED"
  | "MANIFEST_INCOMPLETE";

type LegacySparkRetirementBackupVerification =
  | Readonly<{
      status: "backup-verified";
      manifest: LegacySparkRetirementBackupManifest;
      reasons: readonly [];
    }>
  | Readonly<{
      status: "incomplete";
      reasons: readonly LegacySparkRetirementBackupReasonCode[];
    }>
  | Readonly<{
      status: "invalid";
      reasons: readonly LegacySparkRetirementBackupReasonCode[];
    }>;
```

Rules:

- `incomplete` means required evidence is absent but no supplied artifact has
  yet proved corrupt;
- `invalid` means supplied evidence failed integrity or semantic validation;
- reason ordering is deterministic and duplicates are removed;
- reasons contain codes only, never filenames derived from private content,
  creative text, OAuth data, or raw parser excerpts;
- all branches and nested values are frozen;
- `backup-verified` is the highest R2 state.

## Rollback Contract Boundary

R2 creates evidence for a future rollback but implements no restore.

### A. Exact replace restore of Sparks

Recommended future default. Under an explicit recovery tool, pause sync, verify
the backup and Package baseline, preview the exact Spark replacement, take a
fresh pre-restore safety snapshot, replace only the Spark collection, read it
back, and prove Packages unchanged.

This preserves original Spark IDs and timestamps. It is still only local until
the separately designed Drive/device rollback protocol restores or supersedes
remote tombstones. Sync must not resume prematurely.

### B. Reissue live Sparks with newer timestamps

Not the default. It can beat newer tombstones but rewrites historical
`updatedAt`, changes semantic history, and can create another cross-device
conflict. Permit only under a separately reviewed salvage workflow.

### C. Replace the complete local DB snapshot

Rejected as the default retirement rollback because it can overwrite valid
WriterPackages created or edited after the backup. It is appropriate only for
a distinct disaster-recovery decision with its own current-state backup and
Package comparison.

The future rollback must be an explicit recovery tool, not ordinary import. It
requires a preview, verified artifact hashes, a current Package baseline, typed
confirmation, and its own review. R2 does not implement it.

## Pre-R3 Multi-Device Checklist

- PC Writer DB v2 artifact downloaded and reloaded successfully.
- Raw Drive v1 artifact downloaded byte-for-byte, or an explicit
  `drive-backup-not-applicable` status is justified.
- Manifest downloaded and its two data-artifact hashes recalculated.
- Package semantic baseline matches the validated v2 artifact and current raw
  Package source.
- R1 source/device list includes mobile and every other relevant browser or PWA
  profile.
- No device has been reset and no tombstone has been created.
- No legacy Spark is edited during the backup window.
- Devices remain closed, offline, or otherwise prevented from syncing while the
  Drive raw read and backup-set verification are in progress.
- R2 does not call sync on PC, mobile, or any other device.
- Real backup files are stored outside the repository and outside a public web
  folder; they are not deleted as temporary test artifacts.

## R2 Implementation Slices

### R2.1 - Pure backup plan and manifest model

- typed filenames, timestamps, artifact metadata, status, and reason codes;
- pure validation of manifest shape and no private text fields;
- no crypto, bytes, parser, loader, file, storage, network, or UI.

Published in `src/legacySparkRetirementBackupPlan.ts` with artificial checks
only. It accepts explicit safe metadata, requires canonical UTC
`.000Z` timestamps, creates frozen filename/manifest/artifact plans, uses only
`null` hash placeholders, and stops at `planned` with
`nextAllowedStep: "verify-backup"`. It does not create or verify a backup.

This is the smallest safe next implementation step.

### R2.2 - Pure Writer DB v2 verifier

- explicit raw JSON string supplied by the caller, with no hash yet;
- reuse the existing read-only parser;
- add strict count, uniqueness, tombstone, and immutability checks;
- no artifact download or write.

Implemented locally in
`src/legacySparkRetirementWriterDbBackupVerifier.ts`. It accepts one explicit
raw JSON string, reuses the existing read-only Writer DB parser, requires v2,
strict count equality, valid records/timestamps, and unique same-collection
IDs, and returns only frozen text-free summary metadata. Its successful status
is `structure-verified`, not the overall R2 `backup-verified`. It calculates no
hash and reads or creates no file, storage value, manifest, or Drive artifact.

### R2.3 - Pure raw Drive v1 verifier

- verify exact bytes and a separately decoded validation copy;
- distinguish verified, missing, not applicable, and invalid;
- no Google client or fetch.

### R2.4 - Package baseline and fingerprints

- canonical Package and Spark serialization;
- injected standard SHA-256 implementation;
- pure, deterministic, immutable, text-free report.

### R2.5 - Read-only assembly

- inject validated raw storage reads, v2 export read, raw Drive byte read, clock,
  and hasher;
- create downloadable artifacts only after every read/validation gate passes;
- never call sync, merge, storage setters, or Drive writes.

This is the first slice allowed to read real data or create real user files and
must remain separately reviewed from R2.1-R2.4.

### R2.6 - Temporary Data UI guide

- show R1 counts, artifact progress, hashes, Package baseline, and typed status;
- never render or log creative content;
- provide downloads, not automatic repository or cloud storage;
- stop at `backup-verified`.

### R2.7 - Synthetic integration and manual backup

- automated integration uses artificial data only;
- manual PC/Drive backup requires explicit user action;
- reload downloaded files and compare hashes/baseline;
- delete only temporary synthetic test artifacts, never the verified real
  retirement backup set.

Keep R2.1-R2.4 independently reviewable. R2.2 and R2.4 may share a later
canonicalization utility only after its contract is reviewed; do not combine
their commits merely for convenience. R2.5, R2.6, and R2.7 must remain separate
because they introduce real reads, UI, and manual operational evidence.

## Automated Test Plan

Use artificial content only:

- valid Writer DB v2 artifact reaches `backup-verified` only with all required
  artifacts and matching baselines;
- unsupported v2 schema is invalid;
- count mismatch is invalid even though the general parser accepts it;
- duplicate Spark ID and duplicate Package ID are invalid;
- Spark and Package tombstones survive;
- Package notes and deleted notes survive in order;
- valid raw Drive v1 bytes pass without normalization;
- whitespace-only Drive byte change fails raw hash;
- missing in-scope Drive source is incomplete;
- explicit out-of-scope Drive is not applicable;
- Package canonicalization is deterministic;
- every Package field and note mutation changes its fingerprint;
- Spark-only mutation does not change the Package fingerprint;
- Spark semantic mutation changes the Spark fingerprint;
- verifiers do not mutate byte arrays, parsed objects, R1 inventory, or baseline;
- every result and nested collection is frozen;
- reason reports contain no Spark, draft, Package, token, email, or file content;
- no storage, download, merge, Drive, or rollback API is imported or called;
- no result status implies delete, purge, reset, or completion.

## Manual Test Plan

After R2.5-R2.7 are separately approved:

1. Create the PC v2 artifact through the reviewed R2 path.
2. Obtain the raw Drive v1 bytes through the read-only path without sync.
3. Download the text-free manifest.
4. Reopen all three files and recalculate both raw hashes.
5. Parse both JSON data artifacts read-only.
6. Recompute Spark and Package semantic fingerprints.
7. Compare the Package baseline against current raw Package storage.
8. Confirm no local/remote data, transaction marker, or sync state changed.
9. Repeat validation after browser reload.
10. Remove only synthetic temporary test files; retain the verified real backup
    set in the user's chosen private location.

## Privacy And Security

The Writer DB v2 and Drive v1 data artifacts naturally contain creative text.
They must never be:

- committed to Git;
- embedded in automated tests or snapshots;
- printed to logs, console output, errors, telemetry, or screenshots;
- saved under `public`, `dist`, `.vercel`, or another published directory;
- uploaded anywhere except the explicit user-selected private destination.

The manifest contains only counts, safe source kinds/IDs, timestamps,
filenames, byte lengths, statuses, and hashes. Hash inputs may contain creative
text; hash outputs do not reveal that text and are the only content-derived
values allowed in the manifest.

Tokens remain memory-only. OAuth token, Drive file ID, account email, response
headers, and authorization errors must not enter any backup artifact or reason
code.

## Explicitly Out Of Scope

This review does not implement:

- runtime backup or real artifact creation;
- a download button or Data UI;
- raw Drive download;
- hashing of real content;
- storage reads or writes;
- Google Drive sync, upload, create, update, or schema v2;
- rollback or ordinary-import changes;
- reset, tombstone creation, or hard purge;
- WriterPackage editing or autosave;
- product cutover or redesign;
- commit, push, or deployment.

## Decision Summary

R2 requires one validated Writer DB v2 artifact, one byte-exact raw Drive v1
artifact when Drive is in scope, and one text-free manifest. Raw SHA-256 proves
file integrity; canonical SHA-256 fingerprints prove Spark and Package semantic
integrity. WriterPackages are protected by a baseline that later R3-R6 phases
must reproduce exactly.

The highest R2 state is `backup-verified`. It does not authorize deletion.
R2.1 is published as a pure plan and text-free manifest model; its highest
state is only `planned`. R2.2 is prepared locally as a pure Writer DB v2
structure/content verifier over synthetic input. The smallest next
implementation is R2.3, the pure raw Drive v1 verifier, still with no runtime
loader, file creation, storage mutation, Drive write, or UI.
