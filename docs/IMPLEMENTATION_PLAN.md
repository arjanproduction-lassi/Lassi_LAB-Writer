# Implementation Plan

## Current Slice

Build only the true v0.1 loop:

1. Open Writer.
2. Tap "⚡ Nová iskra".
3. Enter one short text spark.
4. Save it locally.
5. See it in recent sparks.
6. Reopen a saved spark.
7. Edit and save it again.
8. Export the local Writer DB as a JSON file.
9. Import a Writer DB JSON file on another device.

The JSON export/import is only a manual device bridge. It does not introduce
cloud sync, accounts, backends, or shared databases.

## Technical Shape

- Vite, React, and TypeScript.
- No backend.
- No routing.
- No extra UI framework.
- `localStorage` only for v0.1 persistence.
- Manual JSON export/import copies the local Writer DB between devices.
- Storage access isolated behind `src/storage.ts` so IndexedDB can replace it
  later without rewriting the app surface.

## Data Shape

The v0.1 `Spark` model contains:

- `id`
- `title`
- `text`
- `createdAt`
- `updatedAt`
- `temperature`
- `tags`
- `schemaVersion`

`temperature` defaults to `"spark"`. `tags` defaults to an empty array.

The manual DB export uses:

- `app`
- `schemaVersion`
- `exportedAt`
- `sparkCount`
- `sparks`

The import path merges sparks by `id`. Existing sparks are updated only when the
imported `updatedAt` value is newer.

## Explicit Non-Goals

- No AI or Kováč implementation.
- No voice recording.
- No melody recording.
- No image upload.
- No Songbook or Storyboard integration.
- No accounts.
- No cloud sync.
- No collaboration.
- No Songbook or Storyboard export bridges.
- No shared import/export contract beyond the manual Writer DB JSON file.
