# Writer Legacy Spark Backup Guide Review

Status: R2.6 docs-only review. No runtime adapter, UI, CSS, Blob/download,
file picker, Web Crypto implementation, real localStorage read, Google Drive
request, backup artifact, commit, push, or deployment is part of this step.

Published boundary: R2.5 is committed at
`ffd7090bf0d5a911d0a074ce1d764dd4ab0e8a28`. It exposes only the dependency-
injected `assembleLegacySparkRetirementBackup` coordinator. A successful R2.5
result is `assembly-verified` and allows only `present-backup-download`. It is
not `backup-verified`, does not prove a browser download was saved, and never
authorizes R3, tombstones, reset, purge, import, sync, or rollback.

## Existing Runtime Inventory

Current Spark storage uses `lassilab-writer:v0.1:sparks`. The private
`readRawSparks()` function reads `window.localStorage.getItem`, parses JSON,
filters records through `isSpark`, and returns `[]` when the key is missing,
the value is not an array, or JSON parsing fails. `listSparks()` then filters
out tombstones and sorts visible Sparks by `updatedAt` descending.
`loadWriterDbExportSparks()` returns the filtered raw Spark array including
tombstones, in the storage array order.

Current WriterPackage storage uses `lassilab-writer:v0.1:packages`.
`loadWriterPackages()` reads `window.localStorage.getItem`, parses JSON,
filters through `isWriterPackage`, and returns `[]` for missing, non-array, or
damaged JSON. This is not enough for R2.6 because it collapses a missing key,
a damaged key, and an empty valid array into the same public result. The
catalog path `loadWriterPackageCatalog()` must not be used for backup because
it adapts visible Sparks into fallback packages and filters tombstones.

The current manual Writer DB v2 export is `createManualWriterDbV2Export()`. It
returns a Writer DB object, not a JSON string and not bytes. It calls
`loadWriterDbExportSparks()`, `loadWriterPackages()`, and
`createWriterDbV2Payload()`. The payload builder shallow-copies supplied arrays,
uses `schemaVersion: 2`, and defaults `exportedAt` to the current time unless
one is explicitly supplied. The current App download action serializes the
object with `JSON.stringify(value, null, 2)` inside `App.tsx`.

Current Google Drive sync uses Google Identity Services, keeps an in-memory
access token, searches `appDataFolder` for
`lassilab-writer-db-v001.json`, orders matches by `modifiedTime desc`, and
returns the first file or `null`. If the file is absent, sync creates it. If it
exists, sync downloads it through `response.json()`, merges it into local Spark
storage, and then uploads the merged DB back to Drive. Therefore
`syncGoogleDrive()`, its private parsed download path, create path, update path,
and merge path must not be used by the R2 backup guide. There is no current
public GET-only exact-byte Drive reader.

The current Data section in `App.tsx` has manual v1 export, manual v2 test
export, import preview, and Google sync controls. Those controls can inform the
future placement, but R2.6 must not wire the guide into `App.tsx` yet.

The product shell prototype has a `data` view and a `fixture` or
`real-read-only` catalog mode. The real read-only mode uses
`loadWriterPackageCatalog()`, which is useful for product browsing but not for
backup because it combines real visible WriterPackages with adapted visible
Sparks. It must not be reused as a source for R2.6 backup bytes or baselines.

## Production Adapter Contract

R2.6 production adapters should be small browser-only wrappers around the R2.5
dependencies. They must return typed, text-free results and must not throw
private exception text into public status.

### Writer DB v2 bytes adapter

The adapter must synchronously capture one local snapshot first:

- the exact raw Spark storage string, including tombstones;
- the exact raw WriterPackage storage string, including tombstones and deleted
  notes;
- one canonical `createdAt`/`exportedAt` timestamp for the backup run.

It then parses and validates those captured strings, builds a schema v2 Writer
DB payload with all Sparks and all WriterPackages, serializes one exact JSON
string, encodes it with `TextEncoder`, and returns a copied `Uint8Array`. The
serialization format should be the reviewed current browser format,
`JSON.stringify(payload, null, 2)`, with no implicit final newline unless a
later reviewed contract changes it.

The existing `createWriterDbV2Payload()` can be reused as the pure payload
builder only behind a thin adapter that supplies already-captured arrays and an
explicit `exportedAt`. The existing `createManualWriterDbV2Export()` should not
be used directly because it performs separate runtime loads and returns an
object rather than exact bytes.

Ordering must be documented and verified. The safest R2.6 rule is to preserve
the captured storage array order for both collections when creating the backup
bytes, because that is the current manual v2 export contract. Semantic Package
integrity is checked separately by the R2.4 baseline, which sorts Package IDs
for the fingerprint.

### Raw Drive v1 bytes adapter

The Drive adapter must be strictly GET-only:

- use the existing configured OAuth scope only for a read operation;
- find the canonical `appDataFolder` file named
  `lassilab-writer-db-v001.json`;
- if zero files are found and Drive is in scope, return
  `required-but-missing`;
- if exactly one file is found, call the media endpoint and read
  `response.arrayBuffer()`;
- copy the bytes into a `Uint8Array`;
- never parse before preserving bytes;
- never call sync, merge, upload, create, update, or repair.

Signed-out, missing token, expired token, permission failure, offline network,
or failed GET are not `not-applicable`. `not-applicable` requires truthful
product evidence that Drive was outside the declared backup scope. In the
current Writer, where manual Drive sync exists, Drive is normally required.

If more than one untrashed file with the canonical name is returned from
`appDataFolder`, the backup reader must block with a typed result such as
`DRIVE_MULTIPLE_FILES`. It must not silently choose the newest file.

### Current WriterPackages adapter

This adapter must validate only the packages present in the captured raw
Package storage string. It must not migrate, normalize, save, adapt Sparks into
Packages, or filter tombstones. A damaged Package key is a typed invalid
snapshot, not an empty valid package list.

### Raw Package storage bytes adapter

If the Package key is missing, the adapter returns `null` or an explicit
`missing` state. If the key exists and contains `[]`, the adapter returns the
bytes of the exact two-character string after `TextEncoder` encoding. If the
key exists but contains damaged JSON, raw bytes may still be available for a
diagnostic hash, but the current WriterPackages adapter must report invalid
parsed package data. It must never parse before computing the raw hash.

### UTF-8 adapters

Generated backup artifacts must be UTF-8 without BOM. Strict verification
decoding uses `new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` so
invalid UTF-8 is a typed failure and the BOM is not silently removed from the
decoded text. Re-read files must not be normalized. If a BOM appears in
user-selected input, hash the exact bytes first and let the structure verifier
decide from the exact decoded text; do not strip the BOM to make a failing
artifact pass.

### SHA-256 adapters

Use browser Web Crypto only:

```ts
crypto.subtle.digest("SHA-256", bytes)
```

Provide:

- `sha256Bytes(bytes)`;
- `sha256CanonicalUtf8(text)`.

Both functions must make their own byte copy before hashing. Text hashes encode
the exact canonical string through `TextEncoder`. Public hash output is exactly
64 lowercase hex characters. Do not add a SHA dependency and do not use Node
crypto in the browser runtime.

## Consistent Snapshot Rule

Use option D: synchronously capture all local inputs at the start, then compare
a post-assembly local fingerprint before presenting files.

One local snapshot consists of:

- raw Spark storage string;
- parsed and validated Spark array from that raw string;
- raw Package storage string or missing state;
- parsed and validated WriterPackage array from that raw string;
- one canonical `.000Z` `createdAt`/`exportedAt`.

After local capture, the guide may perform the asynchronous Drive GET. Before
showing artifacts, re-read the local raw Spark and Package strings and compare
them with the captured fingerprints or raw hashes. If either changed, return a
typed incomplete/invalid result such as `LOCAL_SNAPSHOT_CHANGED` and require the
user to restart the snapshot. R2.6 should not lock editing as its primary
safety rule; the restart is safer and smaller.

## Backup Artifacts

The future guide prepares the stable filenames from
`buildLegacySparkBackupFileNames(createdAt)`:

- Writer DB v2 data artifact;
- raw Drive v1 data artifact when Drive is required and present;
- text-free manifest.

The Writer DB v2 and Drive v1 files contain author text. The manifest must not
contain author text, OAuth tokens, account email, Drive file ID, response
headers, profile paths, or private exception text. The manifest is built only
after R2.5 assembly succeeds, and its raw SHA-256 values must match the exact
bytes offered to the user. For Drive `not-applicable`, the manifest records no
Drive filename or hash and records the truthful state.

Backup files must never be committed, logged, placed under `public`, `dist`,
`.vercel`, or test fixtures, or uploaded by the app.

## Download Boundary

The browser flow may use `Blob`, `URL.createObjectURL`, an `<a download>` click,
and delayed `URL.revokeObjectURL` after the click has been triggered. That flow
only proves that a download was offered or triggered by the page. It does not
prove the user saved the file, the disk write succeeded, the file was unchanged,
or the user can find it later.

Use these distinct states:

- `assembly-verified`;
- `backup-presented`;
- `downloads-triggered`;
- `downloaded-files-reselected`;
- `backup-verified`.

Never set a `downloaded` or `backup-verified` state from a click event alone.

## Downloaded File Reverification

The only route to `backup-verified` is explicit user re-selection of the saved
artifacts through standard file inputs. A single
`<input type="file" multiple>` is preferred so one backup set is selected at
once. Separate selections are acceptable only if the verifier keeps an
in-memory candidate set and verifies only after all required artifacts are
present.

Artifacts are identified by manifest fields plus content, not filename alone.
The verifier reads bytes without logging them, recalculates raw SHA-256,
decodes strictly, verifies Writer DB v2 structure, verifies Drive v1 structure
when required, parses the manifest, and cross-checks every derived value.

Rules:

- Drive `not-applicable` means no Drive data file is required, but the manifest
  must prove that state.
- A missing manifest is incomplete.
- An older or wrong manifest is invalid when hashes, filenames, timestamps, or
  counts do not match the selected artifacts.
- Files from different backup runs are invalid.
- Same filename with a different hash is invalid.
- Missing required data artifacts are incomplete.
- Re-selected files are never imported into the app.

## Manifest Cross-Check

Manifest verification must not trust manifest values by themselves. It must
recompute and compare at least:

- `backupVersion`, `purpose`, and canonical `createdAt`;
- expected filenames;
- Writer DB and Drive schema versions;
- raw SHA-256 of each selected data artifact;
- Spark counts, live counts, tombstone counts, and sorted Spark IDs;
- Package counts, live counts, tombstone counts, note counts, deleted note
  counts, and sorted Package IDs;
- Package semantic SHA-256 from the decoded Writer DB v2 backup;
- raw Package storage SHA-256 or explicit null/missing state from the original
  assembly manifest;
- Drive `present`, `required-but-missing`, or `not-applicable` state.

Count mismatches, schema mismatches, hash mismatches, Package baseline
mismatches, and missing required artifacts block `backup-verified`.

## Temporary Data Guide Flow

The future UI belongs under the existing Data section and should not redesign
the app.

1. Check prerequisites: Drive configured/signed-in status, local Spark summary,
   WriterPackage summary, R1 inventory summary, and resurrection risk. No data
   changes occur.
2. Create snapshot: read-only local capture, read-only Drive GET when required,
   clear privacy warning that data artifacts contain author text, and typed
   text-free progress.
3. Present files: Writer DB v2, Drive v1 when required, and manifest, each with
   filename, size, short hash identifier, and status.
4. Reselect saved files: the user chooses the saved artifacts; the app verifies
   them only and imports nothing.
5. Backup verified: show timestamp, filenames, counts, shortened hashes,
   Package baseline matched, Drive state, and a warning that R3 has not started.

The guide must not show destructive buttons such as delete, reset, create
tombstones, purge, or continue to R3 automatically.

Backup creation itself is non-destructive, so an explicit button plus privacy
acknowledgement is enough for R2. A typed confirmation belongs before the
separate R3 tombstone/reset phase.

## Auth And Drive Error States

Use typed reason codes such as:

- `DRIVE_SIGNED_OUT`;
- `DRIVE_TOKEN_MISSING`;
- `DRIVE_TOKEN_EXPIRED`;
- `DRIVE_PERMISSION_MISSING`;
- `DRIVE_FILE_MISSING`;
- `DRIVE_MULTIPLE_FILES`;
- `DRIVE_GET_FAILED`;
- `NETWORK_OFFLINE`;
- `DRIVE_CONTENT_INVALID`;
- `DRIVE_REAUTH_REQUIRED`.

These states can ask the user to sign in or retry, but they must not upload,
create a new Drive file, repair Drive content, start sync, or merge local and
Drive Sparks.

## Status Machine

Recommended status model:

- `idle`;
- `checking-prerequisites`;
- `snapshot-capturing`;
- `drive-reading`;
- `assembling`;
- `assembly-verified`;
- `backup-presented`;
- `downloads-triggered`;
- `downloaded-files-reselected`;
- `backup-verified`;
- `incomplete`;
- `invalid`.

`backup-verified` means assembly passed, artifacts were presented, the user
re-selected the saved files, raw hashes matched, structure verification passed,
manifest cross-check passed, and the Package baseline matched.

`backup-verified` still does not mean ready to create tombstones, R3 approved,
reset approved, safe to purge, or retirement complete. R3 remains a separate
reviewed action.

## R2.6 Implementation Phases

R2.6.1: Pure guide types, reason codes, state machine, and transition checks.
No storage, Drive, file, crypto, or UI.

R2.6.2: Browser UTF-8 and Web Crypto adapters with synthetic unit checks. No
real data.

R2.6.3: Read-only local snapshot adapter. This is the first phase that reads
real author data from the active browser profile.

R2.6.4: GET-only raw Drive v1 reader. This is the first phase that may read
real remote author data after explicit sign-in/token availability.

R2.6.5: Artifact builder and download controller. This is the first phase that
creates real files for the user to save.

R2.6.6: Read-only downloaded-file re-verifier with manifest cross-check.

R2.6.7: Temporary Data-section UI guide wired to the reviewed adapters.

R2.6.8: Synthetic integration test plus explicit manual PC backup evidence.

R2.6.1 and R2.6.2 may be combined only if the diff remains pure and synthetic.
R2.6.3, R2.6.4, R2.6.5, R2.6.6, R2.6.7, and R2.6.8 should remain separate
review points because they first touch real local data, Drive, files, UI, and
manual operational evidence.

The smallest safe next implementation step is R2.6.1.

## Test Plan

Automated tests use synthetic data only:

- stable local snapshot;
- local data changes after snapshot start;
- Writer DB exact bytes;
- Drive exact bytes;
- strict UTF-8 and BOM behavior;
- Web Crypto hash adapter;
- invalid hash output;
- Drive signed-out, token expired, missing source, multiple files, permission
  failure, offline, and GET failure;
- Blob/download controller without any automatic `downloaded` claim;
- object URL revoke timing;
- reselect correct artifacts;
- missing manifest;
- wrong manifest;
- files mixed from different backup runs;
- raw hash mismatch;
- schema mismatch;
- count mismatch;
- Package baseline mismatch;
- Drive `not-applicable`;
- deeply frozen public results;
- no author text in status or reason output;
- no upload, merge, sync, storage write, import, rollback, or R3 transition.

Manual preview/production test after implementation approval:

1. Create Writer DB v2, Drive v1, and manifest artifacts.
2. Save them in a private folder outside the repository.
3. Reselect the saved files.
4. Verify hashes, structures, manifest, and Package baseline.
5. Reload the page.
6. Confirm local Spark and WriterPackage storage hashes are unchanged.
7. Confirm Drive file metadata and content are unchanged.
8. Confirm no author content was logged or committed.

## Out Of Scope

R2.6 review does not implement runtime adapters, Web Crypto, Drive GET, Blob,
download, file picker, UI, real backup, import, rollback, tombstones, reset,
purge, R3, package-only product cutover, Drive schema v2, a new OAuth client,
billing changes, commit, push, or deployment.
