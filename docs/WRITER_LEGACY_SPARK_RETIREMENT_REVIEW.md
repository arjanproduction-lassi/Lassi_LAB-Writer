# Writer Legacy Spark Retirement Review

## Status And Scope

This document proposes a safe retirement protocol for test-only legacy
`Spark` records and a later package-only Writer product. It is based on the
published runtime at `f268d569a1c45214090dcac326633afab76c6968`.

This is documentation only. It does not delete data, change storage, alter
Google Drive, add a reset command, migrate Sparks, edit WriterPackages, or
change production UI. Every destructive phase below requires a separate code
review and explicit user confirmation.

The R1 pure inventory kernel is now implemented in
`src/legacySparkRetirementInventory.ts`. It accepts only explicitly supplied,
already typed artificial/runtime inputs and returns frozen metadata with the
single status `ready-for-backup`. It has no loader, UI, storage, network,
current-time, randomness, tombstone creation, reset, or persistence surface.
Its 28 artificial checks run separately through
`npm run check:legacy-spark-retirement`; the Writer DB harness remains an
independent 284-check boundary.

Accepted product decision:

```text
one work = one WriterPackage = one id
```

Existing legacy Sparks are test data. Their current `stage` values do not need
to be migrated into package layers. Existing WriterPackages, including notes
and tombstones, must remain unchanged.

## Evidence From The Current Code

The review is grounded in these implementations:

- `src/storage.ts`
- `src/writerPackageStorage.ts`
- `src/writerPackage.ts`
- `src/writerDb.ts`
- `src/writerDbExport.ts`
- `src/googleDriveSync.ts`
- `src/writerDbImportRuntime.ts`
- `src/writerDbPersistence.ts`
- `src/writerDbRecovery.ts`
- `src/App.tsx`

No current-data counts are inferred from these loaders. The implemented R1
kernel does not call them: a separately reviewed future adapter must validate
and inject each actual browser/Drive profile before any backup phase.

## Current Local Storage Inventory

| Purpose | Current key | Current behavior |
| --- | --- | --- |
| Legacy Sparks | `lassilab-writer:v0.1:sparks` | JSON array containing live Sparks and Spark tombstones |
| WriterPackages | `lassilab-writer:v0.1:packages` | Separate JSON array; not read or written by v1 Drive sync |
| Unsaved new-Spark draft | `lassilab-writer:v0.1:draft:new-spark` | Local-only `{text, updatedAt, schemaVersion: 1}` |
| Spark-only pre-import backup | `lassilab-writer:v0.1:sparks:backup-before-import` | Legacy Spark backup; not automatically restored |
| Spark-only pre-sync backup | `lassilab-writer:v0.1:sparks:backup-before-sync` | Replaced before a v1 sync merge; not automatically restored |
| Sync preferences | `lassilab-writer:v0.1:google-sync-preferences` | Non-secret status and pending-change fields; never an OAuth token |
| Unified Writer DB import backup | `lassilab-writer:v0.1:writer-db:backup-before-import` | Complete Sparks and Packages backup used by coordinated import persistence |
| Writer DB transaction marker | `lassilab-writer:v0.1:writer-db:import-transaction` | Prepared import marker inspected by recovery logic |

The retirement process must not remove the unified import backup, transaction
marker, sync preferences, or either legacy backup merely because their names
contain `sparks`. They have distinct safety roles. Any later retention cleanup
needs a separate inventory and confirmation.

### Spark storage behavior

`listSparks()` reads the complete Spark array, removes records with
`deletedAt`, and sorts visible records by descending `updatedAt`.
`loadWriterDbExportSparks()` returns the complete valid Spark array, including
tombstones.

`deleteSpark(id)` is a soft delete. It preserves the record and sets both
`deletedAt` and `updatedAt` to the same current timestamp. This is what lets a
delete participate in the existing newest-record-wins merge.

`saveSpark()` and `updateSparkStage()` still write the legacy Spark key. The
production `App.tsx` still uses Sparks as its main list and editor model.

### WriterPackage storage behavior

`loadWriterPackages()` reads only `lassilab-writer:v0.1:packages`. Missing
storage, malformed JSON, a non-array value, and an array whose records are all
invalid can all produce `[]`. Therefore that loader alone cannot distinguish a
truthful empty Package collection from damaged or unreadable raw storage.

The future reset inventory must inspect the raw Package value through an
injected read-only storage interface and classify it as:

- key absent and therefore zero stored Package records;
- valid empty array;
- valid non-empty array;
- invalid or partially invalid, which blocks reset.

It must not silently filter invalid Package records and report the result as a
reliable zero count.

`loadWriterPackageCatalog()`:

1. loads real WriterPackages;
2. removes Package tombstones from the visible catalog;
3. loads visible Sparks through `listSparks()`;
4. adapts each remaining Spark into a read-only package-shaped item unless a
   visible real Package already owns the same ID;
5. sorts the combined result by descending `updatedAt`.

After every Spark is tombstoned, or after a later safe hard purge, the catalog
will show only visible real WriterPackages. The adapter does not migrate or
write anything.

### New-Spark draft recovery

The draft key protects only an unsaved new Spark. It is written while typing,
is cleared after a successful new-Spark save or explicit discard, and is not
included in Writer DB export or Google Drive sync.

A leftover draft cannot restore an old Spark ID, but it can make retired test
text reappear in the recovery prompt and can become a new Spark if saved. R6
may remove it only after the preview shows it, the user confirms it is test
content, and it is either separately copied or explicitly discarded.

## Current Writer DB And Drive Shapes

### Manual Writer DB v2

The existing v2 envelope is:

```ts
type WriterDbV2 = {
  app: "LassiLAB Writer";
  schemaVersion: 2;
  exportedAt: string;
  sparkCount: number;
  packageCount: number;
  sparks: Spark[];
  packages: WriterPackage[];
};
```

`createManualWriterDbV2Export()` includes complete valid Sparks, including
tombstones, and complete valid WriterPackages, including Package tombstones and
deleted notes. It is the best current basis for the primary retirement backup,
but only after R1 validates the raw collections. The current Package loader
filters invalid records, so a v2 export created without raw validation could
silently omit damaged Package entries.

The coordinated v1/v2 importer is a merge, not a replace operation. Missing
incoming records do not delete local records. Newer `updatedAt` wins within
each collection; equal or older incoming records do not replace local records.

### Google Drive v1

Current Drive facts:

- scope: `https://www.googleapis.com/auth/drive.appdata`;
- folder: hidden Google Drive `appDataFolder`;
- canonical filename: `lassilab-writer-db-v001.json`;
- envelope: Writer DB `schemaVersion: 1`;
- content: Sparks only;
- WriterPackages and the new-Spark draft are not included;
- OAuth access token exists only in memory;
- non-secret sync preferences remain local.

If the canonical Drive file is absent, sync creates it from the current local
Spark array. If it exists, sync downloads it, merges it into local Spark
storage, creates a new merged v1 export, and uploads that merged export back to
the same file.

### Exact merge and deletion rules

For one Spark ID:

- remote ID missing locally: remote record is added locally;
- same ID on both sides: strictly newer `updatedAt` wins;
- equal timestamps: the current local record is kept on that device;
- local ID missing remotely: the local record is counted as needing push and
  remains in the merged result;
- a tombstone is just a Spark with `deletedAt`; it wins only when its
  `updatedAt` is strictly newer than the competing live record;
- absence from either array never means deletion.

Consequences:

- clearing one local Spark key is not a distributed delete;
- uploading `{ sparks: [] }` is not a distributed delete;
- a stale device can upload live Sparks again;
- a newer live edit, equal timestamp conflict, or badly skewed clock can beat
  an older tombstone;
- a Drive file containing propagated newest tombstones is the only deletion
  fence supported by the current v1 merge.

## Production UI Still Owned By Sparks

The production `App.tsx` currently:

- initializes the main list with `listSparks()`;
- opens and saves Sparks through `saveSpark()`;
- soft-deletes through `deleteSpark()`;
- shows the Spark `stage` filters Iskra, Poznámky, Dielňa, and Text OK;
- changes `stage` through the `Zošit` selector;
- labels cards as editable Sparks;
- owns new-Spark draft recovery;
- exports v1 Sparks and a separate validated v2 test export;
- reloads Sparks after import and Google sync.

The isolated product shell and read-only B5 Library/detail do not change that
production ownership. R7 must replace the old product surface deliberately;
the data reset alone does not make production package-only.

## Resurrection Strategy Comparison

### A. Physically remove Spark localStorage on one PC

PC immediately appears empty, but the remote file still contains the records.
The next PC sync downloads and adds them again. Mobile and other devices retain
their local copies and can upload them. WriterPackages survive if and only if
the operation touches only the Spark key.

Result: unsafe. Old Sparks are expected to return. Confirmation of one device
is insufficient.

### B. Replace the Drive v1 database with an empty `sparks` array

An existing device merges the empty remote array into its non-empty local
array. Because missing remote records are not deletes, its local Sparks remain
and are uploaded back to Drive. A locally empty PC does not help when mobile or
another profile still has records.

Result: unsafe. Empty Drive is not a deletion instruction and can be
repopulated by any stale device. WriterPackages remain local and untouched, but
every device must still be handled.

### C. Soft-delete all Sparks and sync tombstones

If the tombstones have strictly newer `updatedAt` values, a syncing device
replaces its older live records with those tombstones. The records disappear
from normal Spark lists and from the adapted Library while remaining in the v1
payload as a deletion fence.

A device with a live record whose `updatedAt` is newer than or equal to the
tombstone can keep and upload that live record. An offline device that never
receives the tombstone remains dangerous.

Result: viable propagation mechanism, but not sufficient without a union
inventory, timestamp validation, a write freeze, and confirmation from every
device/profile.

### D. Coordinated hard reset on every device

If sync is paused, every browser profile is inventoried and cleared, and the
canonical Drive file is replaced only after every device is confirmed, the
result can be clean. A forgotten phone, tablet, installed PWA profile, or old
browser can later repopulate Drive because no tombstone fence remains.

Result: conditionally safe only with a complete device inventory. It is fragile
when any device or profile is uncertain.

### E. Soft delete, propagate everywhere, then optionally hard purge

Build tombstones for the union of Spark IDs found on the authoritative PC,
Drive v1 file, and every active device. Make each tombstone timestamp strictly
newer than every observed version of the same ID. Freeze legacy editing, sync
the tombstones to Drive, then sync and verify every device one at a time. Keep
the tombstones as a quarantine fence while offline/relogin/reload checks run.

Only after every device/profile is confirmed retired may a separate R6 remove
local tombstones and replace the canonical Drive file with a valid empty v1
database. If any device is unknown, keep the tombstone fence and skip hard
purge.

Result: recommended. It best matches the current merge semantics and gives a
stale device a deletion record to receive before it can republish old data.

### Cross-device comparison

| Strategy | Authoritative PC | Mobile | Other device/profile | Drive after sync | Can live Sparks return? | WriterPackages | Confirm every device? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Clear one PC | Locally empty until sync | Keeps and can upload live records | Keeps and can upload live records | Existing remote records merge back; PC records are repopulated | Yes | Untouched only if the operation is strictly Spark-key-only | Yes; without that, unsafe |
| B. Empty Drive array | Local records remain and are pushed | Local records remain and are pushed | Local records remain and are pushed | Empty array is repopulated because absence is not delete | Yes | Untouched | Yes; even then empty Drive alone is not a reset |
| C. Tombstone and sync | Hides records and uploads newest tombstones | Becomes safe only after receiving and verifying the fence | An offline or newer-live profile remains a resurrection source | Holds tombstones during transition | Yes, until every competing version is older and every profile has synced | Untouched when the write path is Spark-only | Yes |
| D. Hard-reset all | Empty after coordinated clear | Must be cleared in the same window | Every profile must be found and cleared | Can be replaced with a valid empty v1 file only after all local copies are gone | Yes, if one forgotten device returns later | Untouched only under a proved Spark-only operation | Yes, with no unknown profiles |
| E. Fence, verify, optional purge | Creates and verifies the union tombstone set | Receives and verifies newest tombstones before any purge | Each profile must receive the same fence or be permanently retired | Keeps the tombstone fence through observation; valid empty v1 is optional later | Not after the completed declared-device protocol; an unknown device means the protocol is not complete | Protected by raw and semantic before/after invariants | Yes; otherwise keep the fence indefinitely |

## Recommended Retirement Protocol

Use strategy E. Do not begin with physical deletion or an empty Drive file.

### Preconditions

- list every PC browser profile, mobile browser/PWA, tablet, and other device
  that has used Writer;
- stop legacy Spark editing during the reset window;
- do not allow quiet sync to run while preview and backup are still being
  prepared;
- require a clean Writer DB recovery inspection before any reset write;
- validate raw Spark and Package storage; damaged or ambiguous data is no-go;
- read the canonical Drive v1 file without merging it into local state;
- compute the union of IDs and maximum observed `updatedAt` values;
- produce and verify both backups below;
- record the exact Package raw hash and semantic manifest.

The current UI has no safe reset-wide sync pause or remote read-only inventory.
Those capabilities belong in the future reviewed reset tool; users must not be
sent to DevTools or asked to edit unknown storage keys.

### Tombstone fence

For each union Spark ID, R3 prepares one valid Spark tombstone. Its
`deletedAt` and `updatedAt` must be identical and strictly later than every
observed version of that ID. Existing IDs, creation times, schema version,
tags, and other valid Spark fields remain valid.

The preview must block if it cannot prove the timestamp ordering, if duplicate
IDs exist, or if a device/Drive snapshot needed for the declared device set is
missing.

The first persistence operation changes only the Spark collection. It must not
call `saveWriterPackages`, `upsertWriterPackage`, Package import, or any Package
storage setter.

## Mandatory Backup Contract

The detailed docs-only R2 contract is defined in
`WRITER_LEGACY_SPARK_BACKUP_REVIEW.md`. It supersedes the illustrative
filenames and abbreviated checks below with three explicit artifacts: a
validated Writer DB v2 backup, an exact raw-byte Drive v1 backup (or a proven
not-applicable result), and a text-free manifest containing raw SHA-256 hashes,
semantic fingerprints, validation evidence, and the WriterPackage baseline.
The pure R2.1 plan/model, R2.2 Writer DB v2 artifact verifier, and R2.3 Drive v1
artifact verifier are published; R2.3 is at
`a1c16610a7d404d401a28295bc161c40d6168a6d` and stops at
`structure-verified`. Pure R2.4 is published at
`5ae5cbaa4ad044b9ebd62bf15d8d5bff50ba4ed1` and stops at
`baseline-built`: it validates supplied WriterPackages and produces only
text-free counts, sorted IDs, and an awaited injected semantic SHA-256 result
compatible with a future asynchronous Web Crypto adapter. These
slices create no backup; R2.3 calls no Drive or sync path and proves no
byte-exact integrity, while R2.4 calls no crypto or storage implementation.
Pure R2.5 is published at
`ffd7090bf0d5a911d0a074ce1d764dd4ab0e8a28` and coordinates injected synthetic
exact bytes, strict decoding, hashing, structure verification, and
current/backup Package baseline comparison. It stops at `assembly-verified`,
`incomplete`, or `invalid`, creates/downloads no file, and has no production
storage, Drive, or crypto adapter. R2.6 is the docs-only backup guide and
production adapter review in `WRITER_LEGACY_SPARK_BACKUP_GUIDE_REVIEW.md`.
R2.6.1 is a pure guide state model with no UI, storage, Drive, crypto, file, or
artifact behavior. R2.6.2 adds strict browser UTF-8 plus Web Crypto SHA-256
adapters with synthetic checks, byte copies before async digest, and no Node
crypto, storage, Drive, Blob/File/download, real data, or artifact creation.
The next R2 slice is the R2.6.3 docs-only local snapshot review, and even the
future highest `backup-verified` result grants no permission to create
tombstones, delete data, reset storage, sync, or begin R3.

R2.6.3 is documented in `WRITER_LEGACY_SPARK_LOCAL_SNAPSHOT_REVIEW.md`. It
keeps the review docs-only, defines the future read-only local snapshot
adapter, and recommends that the first implementation slice remain pure over
synthetic raw strings before any real `localStorage.getItem` adapter exists.

R2.6.3a is published at `fc741821a49a957b85d1f3fc9a0c4d72d6f9faa3` as that pure parser/model. It reads no storage,
uses only explicit synthetic raw strings, and stops at `snapshot-captured`,
`incomplete`, or `invalid`. It creates no backup bytes and grants no R3
permission. R2.6.3b exact Writer DB v2 byte construction is published at
`389b6347ec84d5472aa62a86d11fdff3416fed6d`; it creates only an in-memory
copied artifact and remains below backup assembly or verification. Pure
injected R2.6.3c1 is published at
`9d8168e1237d16eea0cbd06de0d923142f7de8cf` with fixed three-key order and no
partial snapshot after read failure. Import-safe c2a is published at
`58b99036878b9975c527373f66b82e248bee9408` with 39 synthetic checks, one lazy
Storage acquisition, and no App/UI wiring or real data read. The user-gesture
review separates pure c2b1 one-shot session logic from later c2b2 UI wiring.
c2b1 is published at `315b24b695113ff1dcc8c6f633428e483b100c02` with 45
synthetic checks, injected dependencies only, closure-held snapshot state, and
no production c2a wrapper import. The docs-only c2b2 minimal UI capture review
is prepared locally in `WRITER_LEGACY_SPARK_MINIMAL_UI_CAPTURE_REVIEW.md`. Only
approved c2b2 may first read real localStorage data after a click; it does not
authorize retirement or deletion.

The existing Drive sync request is not a raw-backup reader: it parses JSON and
then participates in merge/upload behavior. A future R2 implementation must use
a separately reviewed read-only byte path that cannot call sync, merge, local
storage writes, Drive upload, or file creation in Drive.

### Primary full backup

Create a validated Writer DB v2 file before R3:

```text
LassiLAB_Writer_DBv002_before-legacy-spark-retirement_<UTC timestamp>.json
```

Required validation:

- `app === "LassiLAB Writer"`;
- `schemaVersion === 2`;
- `sparkCount === sparks.length`;
- `packageCount === packages.length`;
- every Spark and WriterPackage is valid;
- IDs are unique inside each collection;
- Spark and Package tombstones are present when stored;
- Package notes, including deleted notes, timestamps, and `packageVersion`
  survive unchanged;
- a SHA-256 checksum is calculated for the downloaded file.

Backup generation and validation are read-only. The backup must never be
written into the repository, logs, snapshots, or test fixtures.

### Separate Drive v1 copy

Download the raw canonical `lassilab-writer-db-v001.json` before changing it:

```text
LassiLAB_Writer_Drive_v001_before-legacy-spark-retirement_<UTC timestamp>.json
```

Validate its v1 envelope, `sparkCount`, Spark records, and checksum. A future
tool may also archive a noncanonical copy in `appDataFolder`, but the historical
copy must not retain the canonical filename because current sync searches that
exact name.

### Restore truth

The backup preserves recovery evidence, but the current normal import is a
newest-record-wins merge. After R3 creates newer tombstones, importing the old
backup will not automatically restore older live Sparks. A post-R3 rollback
therefore needs a separately reviewed restore operation that either restores
the validated snapshot before sync resumes or deliberately reissues selected
records with newer timestamps. Do not advertise ordinary v2 import as a proven
one-click undo for retirement.

R3 is no-go until that rollback behavior is explicitly designed and tested.

## WriterPackage Protection Contract

The Package collection is an invariant, not merely an expected count.

Capture before R3:

- whether the raw Package key is absent, valid empty, valid non-empty, or
  invalid;
- raw-byte SHA-256 hash;
- validated `packageCount`;
- ordered Package IDs;
- every Package `createdAt`, `updatedAt`, and optional `deletedAt`;
- ordered note IDs and all note timestamps/deletion flags;
- semantic canonical hash of the validated Package array.

Require after every local reset, Drive sync, reload, import check, and final
verification:

- raw Package value is byte-for-byte unchanged;
- raw and semantic hashes match;
- `packageCount` matches;
- IDs, timestamps, layers, legacy metadata, and notes match;
- no Package storage write was attempted.

If Package storage is invalid or the raw state cannot be classified, stop. Do
not reinterpret the loader's `[]` result as proof that no Packages exist.

## What May Eventually Be Retired

Only after R5 succeeds:

- visible legacy Sparks;
- Spark tombstones, optionally and only under the R6 gate;
- the new-Spark recovery draft, only after explicit preview/backup/discard;
- the old Spark list, Spark editor, stage filters, `Zošit` selector, and
  “Upraviť iskru” product language during R7;
- Spark-only backup values only under a separately reviewed retention policy.

Preserve:

- every WriterPackage and WriterPackage note;
- Writer DB v1/v2 parsing, preview, backup, persistence, rollback, and recovery
  safety;
- unified Writer DB backup and transaction keys;
- Google OAuth configuration and non-secret sync preferences unless a separate
  reset decision requires changing them;
- the product shell and B5 read-only Library/detail;
- all other LassiLAB applications and storage.

## Google Drive And Multi-Device Checklist

### Authoritative PC

1. Confirm the declared device/profile list and freeze Spark editing.
2. Run R1 against local raw storage and read-only Drive inventory.
3. Verify the v2 full backup, raw Drive v1 copy, and their checksums.
4. Verify Package raw and semantic hashes.
5. Preview the union tombstone set and maximum timestamp evidence.
6. Confirm R3 explicitly; write only the Spark tombstone collection.
7. Sync once to place the tombstone fence in the canonical Drive v1 file.
8. Read back Drive and verify every union ID is a newest tombstone.

### Mobile

1. Keep the old app/profile closed until the Drive fence is verified.
2. Open the current Writer without editing or saving a Spark.
3. Connect Google manually if the in-memory token is absent.
4. Sync, reload, and confirm no visible Sparks return.
5. Verify the local raw Spark collection contains the expected tombstones.
6. Verify Package count, IDs, timestamps, notes, and hashes are unchanged.
7. Sync a second time and confirm Drive remains tombstone-only for the union.

### Every additional device or browser profile

Repeat the mobile sequence independently. An installed PWA and a normal browser
may have different storage profiles and must be treated as separate clients.
Record confirmation for each declared profile.

### Final round

1. Return to the authoritative PC and sync again.
2. Re-read Drive without merging and verify the same tombstone union.
3. Test reload, Google logout/login, offline opening, and online return.
4. Observe at least one complete cross-device sync round with no live Spark.
5. Keep the tombstone fence if any device/profile remains unknown.

## Future Package-Only Product Cutover

### Knižnica

- displays only real WriterPackages;
- has no Spark stage filters or standalone Spark cards;
- has no old “Upraviť iskru” action;
- continues to hide Package tombstones.

### Nová iskra

- creates one new WriterPackage directly;
- assigns one Package ID that survives through every layer;
- fills `sparkText`;
- starts `notes`, `workshopText`, and `finalText` empty;
- does not create a parallel Spark record.

### Dielňa

- edits layers of the selected WriterPackage;
- stores notes inside that Package;
- does not move a record through a `Zošit` stage selector.

### Dáta

- owns backup, import/export, sync, and recovery;
- may temporarily expose the reviewed retirement wizard;
- must keep package-only sync as a separate future design because Drive is
  currently v1/Sparks-only.

R7 must not pretend Package sync exists. Creating Packages in production before
a safe cross-device Package transport decision would strand new work on one
device.

## Reset Tool Decision

### Options

| Option | Assessment |
| --- | --- |
| A. Development-only script | Poor fit: browser storage and Drive auth are profile-specific, and it requires developer tooling |
| B. Temporary Dáta wizard | Recommended: can preview the exact active profile, create downloads, use explicit confirmation, and guide Drive/device propagation |
| C. Special reset DB import | Not preferred: current import is merge-only; an empty DB deletes nothing and a hand-built tombstone DB is error-prone |
| D. Manual DevTools edit | Rejected: unreviewable, hard to repeat, and too easy to touch the Package key or wrong profile |

The preferred implementation is a temporary, explicitly gated wizard in
**Dáta**, not a one-click destructive button. It should use injected storage and
Drive adapters and keep private text out of logs and screenshots.

### Wizard states

1. `inventory-ready` — read-only counts, validity, device scope, recovery gate,
   Package hashes, and Drive availability;
2. `backup-required` — downloads not yet produced or verified;
3. `reset-confirm-ready` — backup checksums accepted and tombstone preview
   stable;
4. `applying-local-tombstones` — single guarded Spark write;
5. `drive-propagation-required` — canonical Drive fence not yet verified;
6. `device-verification-required` — declared devices incomplete;
7. `quarantine-complete` — R5 passed; R6 remains optional;
8. explicit blocked/failed states with no optimistic success.

Example confirmation:

```text
Odstráni sa 7 testovacích Sparks z bežného zobrazenia.
Vytvorí sa 7 synchronizačných tombstones.
WriterPackages: 3 položky zostanú nezmenené.
Pred pokračovaním musí byť overená úplná v2 záloha a Drive v1 kópia.

Napíšte: ODSTRÁNIŤ TESTOVACIE SPARKS
```

The real counts come from the validated preview. The button stays disabled for
invalid Package storage, dirty import recovery, missing backup verification,
unavailable Drive inventory when Drive is in scope, or changed preview hashes.

R1 must create no storage key. Any proposed durable reset marker in later
phases requires explicit storage-key review; do not silently reuse the
import-specific transaction marker for a different operation.

## Reset Execution Phases

### R1 — Pure read-only inventory and preview

- implemented over existing `Spark`, `WriterPackage`, Drive v1 export, and
  `WriterDbV2` types supplied explicitly by the caller;
- computes a deterministic union of Spark IDs, maximum observed `updatedAt`,
  per-source live/tombstone counts, Package count, draft presence, and a
  conservative live-copy resurrection-risk flag;
- rejects duplicate source IDs, duplicate Spark IDs within one source, and
  duplicate Package IDs;
- exposes no Spark, draft, or Package text and returns runtime-frozen metadata;
- ends only at `ready-for-backup`; it has no `ready-to-delete`, `safe-to-purge`,
  or `completed` state;
- performs no raw storage load, Drive request, Package hash, backup, proposed
  tombstone construction, write, sync, reset, author-text log, or new key.

The pure R1 kernel is complete. Any real-data reader/validation boundary and
backup/hash creation belong to the separately reviewed R2 preparation; R1
itself remains disconnected from production UI and data.

### R2 — Backup creation and verification

- create the v2 full backup and raw Drive v1 copy;
- validate counts, schemas, records, and checksums;
- prove the post-R3 restore procedure before enabling R3.

R1 and the read-only preview UI may share one review. R2 must remain a separate
go/no-go gate because it creates user artifacts and establishes rollback
authority.

### R3 — Local Spark tombstone reset

- freeze the reviewed preview revision;
- write only the prepared Spark tombstone collection;
- read back and validate it;
- verify Package raw/semantic hashes before reporting local success.

R3 is destructive and must remain separately reviewed from R1/R2.

### R4 — Drive propagation and device confirmation

- publish the tombstone fence to canonical Drive v1;
- verify remote read-back;
- sync each declared device/profile individually;
- prove Package invariants on each device.

R4 must remain operationally separate because partial multi-device completion
is not local success.

### R5 — Resurrection observation

- repeat PC/mobile/other-device sync;
- test reload, offline/online return, and Google reconnect;
- verify no live Spark or unexpected ID returns;
- keep the Drive fence throughout the observation period.

R4 and R5 must not be collapsed into one click.

### R6 — Optional hard purge

- allowed only when every device/profile is confirmed or permanently retired;
- optionally replace each local Spark collection with `[]` and the canonical
  Drive file with a valid v1 envelope whose `sparks` array is empty;
- optionally remove the confirmed test-only new-Spark draft and retired
  tombstones;
- treat Spark-only backup retention as a separate explicit choice;
- skip this phase indefinitely when device inventory is uncertain.

R6 is never required for the package-only UI. Keeping tombstones is safer than
premature purge.

### R7 — Package-only product cutover

- replace the production Spark list/editor with Package Library/Dielňa flows;
- make `Nová iskra` create WriterPackage directly;
- remove stage filters and `Zošit` movement from the primary product;
- keep data, sync, export/import, and recovery truthfully scoped.

R7 is independent from R6 and must be separately reviewed. It may start only
after R5 proves legacy Sparks are not returning and after Package persistence
and cross-device transport have their own approved design.

## Automated Test Plan With Artificial Data

R1 checks:

- counts live Sparks and tombstones separately;
- distinguishes absent, valid empty, valid non-empty, and invalid Package raw
  storage;
- builds the union across local and artificial Drive/device snapshots;
- never mutates inputs, reads no current time unless injected, and writes no
  key;
- rejects duplicate IDs and unverifiable timestamp ordering.

Backup checks:

- v2 backup contains every Spark and WriterPackage;
- counts equal array lengths;
- Spark/Package tombstones, timestamps, Package notes, and deleted notes survive;
- raw Drive v1 copy validates independently;
- backup failure prevents reset;
- ordinary merge-import is not falsely reported as post-tombstone rollback.

Reset checks:

- only the Spark key changes;
- Package raw and semantic hashes remain identical;
- Package count, IDs, timestamps, layers, and notes remain identical;
- all union IDs become strictly newer tombstones;
- repeated R3 is idempotent and does not invent IDs;
- no unapproved storage key is created;
- draft cleanup never touches Package data;
- failed Spark write cannot report success.

Sync protocol checks:

- an empty Drive array does not delete local Sparks and is reported as unsafe;
- local physical deletion followed by sync can resurrect remote Sparks;
- newest tombstones propagate to older live device records;
- a newer/equal live device record blocks completion instead of being silently
  called deleted;
- an offline stale device cannot pass R5 confirmation;
- after every declared device has the fence, repeated sync remains tombstone-only;
- a hard purge is blocked while an unconfirmed device exists.

## Manual Test Plan

Use artificial data only and record hashes/counts, never text:

1. PC: preview, backup, local tombstone application, reload, and Drive read-back.
2. Mobile: sync older live artificial Sparks into the newer tombstone fence,
   reload, and verify Package hash.
3. Additional device/profile: repeat independently.
4. Google logout/login: reconnect and verify tombstones remain authoritative.
5. Offline/online: open a stale device offline, make no edits, return online,
   sync, and verify the fence wins.
6. Repeat every sync twice and finish on the authoritative PC.
7. Verify the new-Spark draft prompt separately.
8. Remove all artificial records and browser artifacts after the test.

## Go/No-Go Gates

Stop before any destructive action when:

- a Package collection is invalid or ambiguous;
- Package hashes differ;
- Writer DB recovery is not clean;
- the v2 or Drive backup is missing or invalid;
- restore after R3 is not proven;
- a declared device/profile cannot be inventoried;
- tombstone timestamps are not strictly newest;
- Drive read-back differs from the planned fence;
- private content would enter logs, tests, screenshots, or the repository.

## Explicitly Out Of Scope

This review does not implement:

- runtime reset or real deletion;
- any storage-key change;
- Package editing or autosave;
- Package sync or Google Drive schema v2;
- Spark-to-Package migration;
- production package-only cutover;
- per-note merge;
- redesign;
- AI or Kováč;
- commit, push, or deployment.

## Decision Summary

Simple local deletion and an empty Drive file are unsafe because the current
merge treats missing records as “keep/push”, not delete. Use a newest-tombstone
fence built from the union of all known device and Drive IDs, propagate it to
every profile, observe it through reload/offline/reconnect cycles, and hard
purge only when no stale device can return. Keep the fence indefinitely when
device inventory is uncertain.

The reset must be Package-blind at write time and Package-strict at verification
time: the raw Package value and semantic Package hash must remain unchanged.
The smallest safe next code slice is R1 only — a pure, injected, read-only
inventory and preview with artificial checks.
