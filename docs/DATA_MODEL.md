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
};

type WriterNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  order: number;
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
- Spark text becomes package `sparkText`
- package `notes`, `workshopText`, and `finalText` start empty
- Spark `createdAt`, `updatedAt`, and `deletedAt` are preserved
- Spark `stage` remains legacy metadata and should not automatically move text
  into notes, workshop, or final

For sync/export/import, the target is that the whole package travels as one
record. Later optional layers can be added for musical dramaturgy, Suno prompts,
visual/storyboard prompts, publication notes, or booklet metadata without
turning Writer into Songbook or Storyboard.

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
