# Data Model

## Status

This is a conceptual planning model, not a final database schema, API contract,
or export format.

The first implementation should keep storage small, understandable, and
independent from Songbook and Storyboard.

For v0.1, prefer one local spark record before introducing separate tables or
collections for drafts, images, voice, melody, or exports.

The only exception in the current app is a small local recovery draft for a new
unsaved spark. It is not a synced object, not part of the Writer DB export, and
not a replacement for future structured draft/workshop models.

## Data Principles

- Writer owns its own data.
- Songbook owns its own data.
- Storyboard owns its own data.
- Bridges export selected material between tools.
- Shared databases are not part of the plan.
- Persistent keys and export formats should not be finalized until the MVP
  behavior is clearer.

## Target Direction: Writer Package

The current `Spark` record is a useful first storage shape, but the target
Writer object is a **Writer Package / Tvorivá jednotka**: one creative work with
one id and connected layers.

The important product correction:

```text
not one card moving between stages
but one package growing through layers
```

Product data rule:

```text
LassiLAB Writer neukladá poznámky ako voľné kartičky.
Ukladá tvorivé jednotky — balíky s jedinečným ID, v ktorých pôvodná iskra rastie
cez poznámky a dielňu až do publikovateľného textu.
```

Target minimum layers:

- `title`
- `sparkText` - the original spark, the birth certificate of the work
- `notes` - development notes; eventually more than one
- `workshopText` - rough shaping space
- `finalText` - clean accepted text

The `stage` field is backward-compatible and can remain during transition, but
it is not the final workspace model. `stage` says where a card currently sits.
The Writer Package model says how one work grows from first capture to clean
text while keeping the original spark visible.

The safest future migration is additive:

- add `WriterPackage` as the new primary type
- keep old `Spark` records readable as legacy
- save new captures as packages
- show old Spark records as simple packages with `sparkText` filled
- keep manual JSON export/import and Google Drive sync on the same bridge
- let the whole package travel as one record
- only rename or split the data model after the layered workflow is proven

## Core Objects

### v0.1 Spark Record

The first implementation should likely start with a single local record shape.
Field names are placeholders, not a public contract.

Possible fields:

- id
- body
- createdAt
- updatedAt
- deletedAt
- stage
- originHint

`originHint` can be simple text such as "image", "melody", "dream", "line", or
"feeling". It preserves the image-first and spark-first philosophy without
requiring image, voice, or melody capture in v0.1.

`deletedAt` is optional. When present, it marks a sync-safe soft delete. Deleted
sparks are hidden from normal lists, but the record remains in the local DB,
manual JSON export, and Google Drive sync payload so the delete can travel to
other devices. A delete also updates `updatedAt` to the same timestamp so the
existing "newer updatedAt wins" merge rule can carry the tombstone.

Editing an existing spark keeps the same `id` and original `createdAt`, updates
the text, and sets a fresh `updatedAt`. This lets sync treat the edit as a newer
version of the same spark instead of a duplicate spark.

`stage` is an optional backward-compatible field for the four-notebook workflow:

- `spark` = Iskra
- `notes` = Poznámky
- `workshop` = Dielňa
- `final` = Text OK

Old sparks without `stage` are treated as `spark`. The four notebooks are not
separate databases; they are one simple state on the same spark record. Changing
stage keeps the same `id` and `createdAt`, updates `updatedAt`, and travels
through manual JSON export/import and Google Drive sync with the rest of the
spark.

### Target Writer Package

This is the intended next model, not the current runtime schema.

`WriterPackage` should become the primary model for new writing. `Spark` remains
as a legacy readable model so older local data, JSON exports, and synced Drive
DB files do not break.

Minimum target shape:

```ts
type WriterPackage = {
  id: string;
  title: string;
  sparkText: string;
  notes: WriterNote[];
  workshopText: string;
  finalText: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  packageVersion: 1;
  legacy?: {
    source: "spark";
    stage?: SparkStage;
  };
};

type WriterNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};
```

The original `sparkText` is the birth certificate of the work. It should remain
available even after the author adds notes, shapes a workshop version, or writes
the final accepted text.

New captures should be created as `WriterPackage` records with:

- `sparkText` filled from the captured text
- `notes` as an empty array
- `workshopText` empty
- `finalText` empty
- `createdAt` and `updatedAt` set to the capture time

Old `Spark` records should be displayed through a compatibility adapter as
simple packages:

- Spark `id` becomes package `id`
- Spark current text becomes package `sparkText`
- package `notes`, `workshopText`, and `finalText` start empty
- Spark `createdAt`, `updatedAt`, and `deletedAt` are preserved
- Spark `stage` remains legacy metadata and should not automatically move text
  into notes, workshop, or final
- the adapter derives a temporary title from the first non-empty Spark text line
  and does not persist it

Important historical truth:

- Old `Spark` records contain only one current text layer.
- If an old Spark was edited, Writer cannot reconstruct the original historical
  spark or the path of edits from the current record.
- The legacy adapter therefore treats the current text as the initial
  `sparkText` for display only.
- New `WriterPackage` records can preserve layers separately later.

For sync/export/import, the target is that the whole package travels as one
record. Later optional layers can be added for musical dramaturgy, Suno prompts,
visual/storyboard prompts, publication notes, or booklet metadata without
turning Writer into Songbook or Storyboard.

### v1 Legacy Adapter

The first runtime step toward packages is a pure read-only adapter:

```ts
adaptSparkToWriterPackage(spark: Spark): WriterPackage
```

Rules:

- It returns a deterministic `WriterPackage` view of one `Spark`.
- It keeps `id`, `createdAt`, `updatedAt`, and `deletedAt`.
- It copies the current Spark `text` into `sparkText`.
- It starts `notes`, `workshopText`, and `finalText` empty.
- It stores Spark `stage` only under `legacy.stage`.
- It does not write to `localStorage`.
- It does not change the Writer DB export/import schema.
- It does not change Google Drive sync payloads.
- It does not run an automatic migration.

### v1 Package Storage Foundation

Writer Package now has a separate local storage foundation.

Storage key:

```text
lassilab-writer:v0.1:packages
```

This key is separate from the existing Spark key:

```text
lassilab-writer:v0.1:sparks
```

Rules:

- Legacy Sparks remain in the old Spark storage.
- Writer Packages are stored in the package storage.
- The package storage does not rewrite or migrate Spark records.
- The current Writer DB export/import format still exports Sparks only.
- Google Drive sync still carries the existing Writer DB payload.
- The existing DB `schemaVersion` is unchanged.

Package storage helpers:

- `loadWriterPackages()`
- `saveWriterPackages(packages)`
- `upsertWriterPackage(writerPackage)`
- `getWriterPackageById(id)`
- `loadWriterPackageCatalog()`

Validation rules for loading:

- `packageVersion` must be `1`
- `id` must be a non-empty string
- `title`, `sparkText`, `workshopText`, and `finalText` must be strings
- `notes` must be an array of valid notes
- timestamps must be valid ISO-readable date strings
- invalid package records are ignored so one damaged record cannot break the
  app

The shared catalog is read-only. It combines real Writer Packages from package
storage with legacy Sparks adapted through `adaptSparkToWriterPackage`. If the
same id exists in both storages, the real Writer Package wins. The catalog is
sorted by `updatedAt`, newest first.

No automatic migration runs in this step.

## Writer DB v2 Proposal

This is a cautious rollout model. Production import/export and Google Drive sync
still use the existing Writer DB v1 payload. A separate manual test export can
now create a Writer DB v2 payload for validation and inspection.

### Schema Types

Current v1 payload:

```ts
type WriterDbV1 = {
  app: "LassiLAB Writer";
  schemaVersion: 1;
  exportedAt: string;
  sparkCount: number;
  sparks: Spark[];
};
```

Proposed v2 payload:

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

type WriterDb = WriterDbV1 | WriterDbV2;
```

Rules:

- `sparkCount` and `packageCount` are informational only.
- The actual source of truth is the content of `sparks` and `packages`.
- v2 must be able to carry legacy Sparks and Writer Packages at the same time.
- v2 must not perform lossy conversion from Sparks to Packages.
- v2 must not pretend to know historical original sparks for legacy Spark data.

### Read-Only Parser Foundation

`src/writerDb.ts` contains the first read-only parser foundation for
`WriterDbV1 | WriterDbV2`.

Current behavior:

- it validates v1 and v2 envelopes without writing anything
- it returns `{ ok: false }` for unsupported versions, invalid JSON, or invalid
  records inside `sparks` or `packages`
- it treats `sparkCount` and `packageCount` as informational only
- it does not create v2 payloads
- it does not run a migration
- it does not change localStorage
- production v1 export/import still uses the existing v1 format
- Google Drive sync still uses the existing v1 remote payload

### Manual v2 Export Foundation

Writer also has a separate manual Writer DB v2 test export action.

Current behavior:

- it creates `schemaVersion: 2`
- it includes the current Spark records in their storage order
- it includes the current WriterPackage records in their storage order
- it derives `sparkCount` and `packageCount` from the actual arrays
- it validates the created payload before downloading the file
- it creates `LassiLAB_Writer_DBv002_YYYY-MM-DD.json`
- it does not change v1 manual export
- it does not change production import
- it does not change Google Drive sync
- it does not change localStorage keys or migrate data

### Export Rules

Recommended v2 file name:

```text
LassiLAB_Writer_DBv002_YYYY-MM-DD.json
```

v2 export should include:

- all current Spark records, including `deletedAt` tombstones
- all current WriterPackage records, including future `deletedAt` tombstones
- `packages: []` even when no packages exist yet
- informational `sparkCount` and `packageCount`

The v1 export should not be removed until a clear rollout proves that all active
devices can read v2 safely. During rollout, v1 may remain a manual compatibility
export or read-only fallback.

### Import Compatibility Rules

- v1 import remains supported.
- v1 import merges Sparks only.
- v1 import must not delete or overwrite existing Writer Packages.
- v2 import merges both Sparks and Writer Packages.
- Absence of a Spark or Package from an imported file never means local deletion.
- `deletedAt` tombstones must be respected.
- Newer `updatedAt` wins for records with the same id.
- A local backup must be created before applying import changes.
- Invalid payloads must leave local data untouched.

### Read-Only Import Preview Contract

The future manual v1/v2 import must parse and preview the selected file without
writing to localStorage. Preview receives the parsed `WriterDb`, local Sparks,
and local WriterPackages as explicit inputs.

Proposed types:

```ts
type ImportCollectionPreview = {
  mode: "merge" | "untouched";
  incoming: number;
  create: number;
  update: number;
  unchanged: number;
  ignoredOlder: number;
  tombstones: number;
};

type WriterDbImportWarning =
  | { code: "v1-packages-untouched"; message: string }
  | {
      code: "count-mismatch";
      collection: "sparks" | "packages";
      declared: number;
      actual: number;
      message: string;
    }
  | { code: "cross-model-id-overlap"; count: number; message: string }
  | {
      code: "contains-tombstones";
      sparks: number;
      packages: number;
      message: string;
    }
  | { code: "empty-import"; message: string };

type WriterDbImportBlockingIssue = {
  code: "duplicate-spark-id" | "duplicate-package-id";
  count: number;
  message: string;
};

type WriterDbImportPreview = {
  schemaVersion: 1 | 2;
  status: "ready" | "blocked";
  source: {
    declaredSparkCount: number;
    actualSparkCount: number;
    declaredPackageCount: number | null;
    actualPackageCount: number;
  };
  sparks: ImportCollectionPreview;
  packages: ImportCollectionPreview;
  warnings: WriterDbImportWarning[];
  blockingIssues: WriterDbImportBlockingIssue[];
};
```

`actualSparkCount` and `actualPackageCount` come from the arrays and are the
source of truth. For v1, `declaredPackageCount` is `null`,
`actualPackageCount` is `0`, and the package preview has `mode: "untouched"`
with all numeric fields set to zero.

Preview rules:

- A new id is `create`.
- For the same id, a newer incoming `updatedAt` is `update`.
- Equal `updatedAt` instants are `unchanged`, even if their original string
  representations differ.
- An older incoming `updatedAt` is `ignoredOlder`.
- Dates are compared by their parsed timestamp after the DB parser has already
  validated them.
- An incoming record with `deletedAt` is also counted in `tombstones`, but its
  action is still decided by `updatedAt`.
- A new tombstone is stored as a new record so an older live copy cannot revive
  it later.
- `create + update + unchanged + ignoredOlder` equals `incoming`.
  `tombstones` overlaps those actions and is not added to that total.
- A record missing from the incoming file does not delete a local record.
- v1 evaluates only Sparks and leaves WriterPackages untouched.
- v2 evaluates Sparks and WriterPackages independently.
- The same id in a Spark and a WriterPackage is not a conflict or migration.
- WriterPackages are compared as whole records by top-level `updatedAt`.
- Notes are not merged individually.
- Existing local order is preserved. Updates replace the record at its current
  index, and genuinely new records are appended in incoming order.
- Inputs and their nested records are never mutated.

Warnings are informational. Their deterministic order is: v1 Packages
untouched, Spark count mismatch, Package count mismatch, cross-model id
overlap, incoming tombstones, then empty import. Count mismatches produce one
warning per affected collection. Cross-model overlap is the distinct-id
intersection between all local plus incoming Spark ids and all local plus
incoming WriterPackage ids. Tombstone warning counts include incoming records
only. Empty import means no incoming Sparks and, for v2, no incoming Packages.
None of these warnings automatically blocks import.

Duplicate ids inside the same incoming collection are different: the current
read-only envelope parser validates record shapes but does not guarantee id
uniqueness. Preview must report them as `blockingIssues`; no backup, merge, or
write may proceed until the ambiguity is resolved. Cross-model id overlap
remains only a warning. Spark duplicate issues are listed before Package
duplicate issues, `count` is the number of distinct duplicated ids, and
`status` is `blocked` exactly when `blockingIssues` is non-empty. Collection
action counts are still calculated per incoming array element for diagnostics,
but a blocked preview can never become merge input.

Proposed pure boundary:

```ts
type WriterDbImportInput = {
  incoming: WriterDb;
  localSparks: readonly Spark[];
  localPackages: readonly WriterPackage[];
};

function previewWriterDbImport(
  input: WriterDbImportInput
): WriterDbImportPreview;
```

This function does not read or write localStorage, does not migrate data, and
does not call the current production v1 importer.

### ID Conflicts

The same id may temporarily exist as both a legacy Spark and a real
WriterPackage.

Rules:

- Both records may exist during transition.
- The shared read-only catalog prefers the real WriterPackage.
- Import must not automatically delete the Spark when a Package with the same id
  appears.
- Final migration or cleanup must be a separate explicit step.

### WriterPackage Merge Rules

Minimum safe v1 package merge:

- merge by package `id`
- require compatible `packageVersion`
- newer top-level package `updatedAt` wins
- preserve `deletedAt` tombstones using the same newer-`updatedAt` rule
- do not merge notes individually yet

Why whole-package merge first:

- It is the smallest implementation surface.
- It avoids inventing complex conflict rules before the workspace UI exists.
- It matches the current Spark merge model.

Future safer merge may merge notes by `note.id` and `note.updatedAt`, and may
merge individual layers by layer timestamps if the UI later supports parallel
editing on different devices.

### Backup And Recovery

The previewed manual importer needs one detached backup containing the complete
local state of both storage models, even when the incoming DB is v1 and only
Sparks can change.

```ts
type WriterDbImportBackup = {
  backupVersion: 1;
  createdAt: string;
  reason: "before-import";
  sourceSchemaVersion: 1 | 2;
  sparks: Spark[];
  packages: WriterPackage[];
};
```

Implemented pure builder contract:

```ts
type CreateWriterDbImportBackupInput = {
  sourceSchemaVersion: 1 | 2;
  localSparks: readonly Spark[];
  localPackages: readonly WriterPackage[];
  now?: string;
};

type WriterDbImportBackupResult =
  | { ok: true; backup: WriterDbImportBackup }
  | { ok: false; error: string };

function createWriterDbImportBackup(
  input: CreateWriterDbImportBackupInput
): WriterDbImportBackupResult;
```

The builder validates `sourceSchemaVersion`, optional `now`, every Spark, every
WriterPackage, `packageVersion`, and same-collection id uniqueness before
returning a backup. Without `now`, it creates the current ISO timestamp; a
valid supplied `now` is normalized to canonical ISO for deterministic checks.

A successful backup is a detached snapshot of both complete local models even
for a v1 source. It includes tombstones, Spark stage and tags, WriterPackage
notes and deleted notes, workshop/final text, and legacy metadata. The builder
does not persist anything. The future storage adapter must validate the
serialized backup before and after writing it.

Recommended localStorage key for the future previewed v1/v2 importer:

```text
lassilab-writer:v0.1:writer-db:backup-before-import
```

This new shared key is safer than changing the existing Spark-only key:

```text
lassilab-writer:v0.1:sparks:backup-before-import
```

The existing key and its legacy payload must remain unchanged while the current
v1 importer exists. A new valid unified backup may replace the previous unified
`backup-before-import` value, but it must not overwrite or migrate the legacy
Spark-only backup. The unified backup is local only, is not sent to Google
Drive, and is not included in normal v1 or v2 DB exports.

The unified key above is still documentation only. The pure backup factory does
not read or write it and no save/load backup API exists yet.

A malformed backup must never be restored automatically. Recovery first parses
and validates the complete backup; an invalid backup blocks recovery and shows
a clear error without changing either storage model.

### Pure In-Memory Merge Contract

```ts
type WriterDbInMemoryMergeResult =
  | {
      ok: true;
      sparks: Spark[];
      packages: WriterPackage[];
      preview: WriterDbImportPreview;
    }
  | {
      ok: false;
      preview: WriterDbImportPreview;
      error: string;
    };

function mergeWriterDbInMemory(
  input: WriterDbImportInput
): WriterDbInMemoryMergeResult;
```

This function is implemented as a pure, non-persistent step. It calls preview
first and returns `ok: false` without merging when preview is blocked. A valid
merge returns new deeply detached arrays, including copied Spark tags,
WriterPackage notes, and legacy metadata.

It applies exactly the preview rules, including `updatedAt`, tombstones, v1
Packages remaining unchanged, whole-package replacement, no per-note merge, and
no deletion caused by absence from the import. Existing local positions remain
stable, updates replace records at those positions, and new records are
appended in incoming order without automatic sorting.

Before returning `ok: true`, it validates every resulting Spark and
WriterPackage, requires `packageVersion: 1`, and rejects duplicate ids inside a
result collection. It does not read or write localStorage, create a backup, or
connect to production import.

### Future Safe Write Sequence

Selecting a file performs only parse and preview. The required logical order is
parser, preview, detached backup snapshot, in-memory merge, result validation,
and only then guarded storage writes. After the user explicitly confirms
import, the future implementation should:

1. Create a detached backup snapshot of the current Sparks and WriterPackages
   in memory.
2. Compute the complete merge in memory without changing storage.
3. Validate every resulting Spark and WriterPackage and abort on any failure.
4. Serialize, validate, persist, read back, and revalidate the backup under the
   unified backup key. If this fails, abort before production writes.
5. Write a small prepared transaction marker under
   `lassilab-writer:v0.1:writer-db:import-transaction` that references the valid
   backup.
6. For v2, write and read back both Spark and WriterPackage storage. For v1,
   write and read back only Sparks; WriterPackage storage remains untouched.
7. Remove the transaction marker only after all required writes and read-back
   validations succeed.

localStorage makes each `setItem` synchronous, but it does not provide one
transaction across the Spark and WriterPackage keys. The backup plus a small
prepared marker is the minimum safe recovery journal. If a write fails, the
same operation should immediately restore every storage key it changed from the
validated backup and verify the rollback. If the app is interrupted or rollback
also fails, the marker remains; the next app start must block another import and
offer explicit recovery from the validated backup rather than restoring data
silently.

### Future Import Preview UI

The future dialog title reflects the parsed source, for example `Import DB v2`.
It shows Sparks and Creative Packages separately with counts for new, updated,
older ignored, and tombstone records. v1 shows Creative Packages as untouched.
Warnings are visible but non-blocking; blocking issues disable the import
action.

The only commands are `Importovať` and `Zrušiť`. Choosing a file never starts
an import by itself. The import command is available only after a successful
parse and ready preview; it then runs backup, in-memory merge validation, and
the guarded write sequence above.

### Version Meanings

These versions are different and must not be mixed:

- Spark `schemaVersion: 1` describes the shape of one Spark record.
- Writer DB `schemaVersion: 1 | 2` describes the export/import/sync envelope.
- WriterPackage `packageVersion: 1` describes the shape of one WriterPackage
  record.

Changing one of these does not automatically imply changing the others.

### v0.1 New Spark Recovery Draft

Temporary local storage key:

```text
lassilab-writer:v0.1:draft:new-spark
```

Fields:

- `text`
- `updatedAt`
- `schemaVersion`

This protects a new unsaved spark if the app refreshes, closes, or the mobile
browser is interrupted. It is local to the current browser, is not synced to
Google Drive, and is cleared after the spark is successfully saved.

### Spark

A quick captured creative impulse.

Possible fields:

- id
- type
- title
- body
- createdAt
- updatedAt
- source
- mood
- imageRefs
- audioRefs
- draftRefs

Possible spark types:

- text
- image
- voice
- melody
- idea
- line
- fragment

### Image Spark

An image that starts or anchors writing.

Not needed as a separate object in v0.1.

Possible fields:

- id
- fileRef
- caption
- notes
- createdAt
- linkedSparkIds

### Voice Spark

A captured spoken idea, phrase, rhythm, or memory.

Not needed as a separate object in v0.1.

Possible fields:

- id
- audioRef
- transcript
- notes
- duration
- createdAt
- linkedSparkIds

### Melody Spark

A captured melodic or rhythmic idea.

Not needed as a separate object in v0.1.

Possible fields:

- id
- audioRef
- notes
- tempoHint
- keyHint
- createdAt
- linkedSparkIds

### Draft

A shaped writing object that may grow from one or more sparks.

Not needed as a separate object in v0.1.

Possible fields:

- id
- kind
- title
- body
- createdAt
- updatedAt
- sourceSparkIds
- status

Possible draft kinds:

- poem
- lyric
- prose-fragment
- note

### Export Bridge Record

A record of an intentional export action to another tool or file.

Not needed as a separate object in v0.1.

Possible fields:

- id
- target
- sourceObjectIds
- exportedAt
- format
- resultRef

Possible targets:

- file
- Songbook
- Storyboard
- clipboard

## Relationship Notes

- A spark can exist without becoming a draft.
- A draft can come from one spark, many sparks, or none.
- Images, voice sparks, and melody sparks are creative sources, not secondary
  metadata.
- Export bridges should copy or transform selected material. They should not
  depend on direct shared database access.
