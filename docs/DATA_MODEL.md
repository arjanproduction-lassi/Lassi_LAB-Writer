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

This is a design proposal only. Runtime code still writes the existing Writer DB
v1 payload.

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

Before v2 import or v2 sync merge, Writer should create a backup that contains
both local Sparks and local Writer Packages.

Recommended backup contents:

- app name
- backup schema/version marker
- backup timestamp
- Spark storage key and Sparks
- Package storage key and Packages

If a v2 payload is malformed, invalid, or only partially valid, it must not
overwrite local data. Invalid individual records can be skipped only when the
payload envelope itself is trustworthy and a backup already exists.

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
