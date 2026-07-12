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
- originHint

`originHint` can be simple text such as "image", "melody", "dream", "line", or
"feeling". It preserves the image-first and spark-first philosophy without
requiring image, voice, or melody capture in v0.1.

`deletedAt` is optional. When present, it marks a sync-safe soft delete. Deleted
sparks are hidden from normal lists, but the record remains in the local DB,
manual JSON export, and Google Drive sync payload so the delete can travel to
other devices. A delete also updates `updatedAt` to the same timestamp so the
existing "newer updatedAt wins" merge rule can carry the tombstone.

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
