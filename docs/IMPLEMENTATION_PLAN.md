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

## Technical Shape

- Vite, React, and TypeScript.
- No backend.
- No routing.
- No extra UI framework.
- `localStorage` only for v0.1 persistence.
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

## Explicit Non-Goals

- No AI or Kováč implementation.
- No voice recording.
- No melody recording.
- No image upload.
- No Songbook or Storyboard integration.
- No accounts.
- No cloud sync.
- No collaboration.
- No export bridges.
