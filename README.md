# LassiLAB Writer

LassiLAB Writer is planned as a mobile-first PWA authoring tool for poems, lyrics,
voice sparks, ideas, images, fragments, melodies, and a future AI helper called
Kováč.

This repository now contains the first minimal v0.1 app shell plus planning
documents. The app is intentionally small: a local text spark loop only.

## Project Philosophy

- The author is always the creator.
- AI is only one tool in the workshop.
- Writer must be faster than forgetting.
- First comes the image, then the word.
- Voice sparks and melody sparks are core future concepts.
- Databases stay independent from Songbook and Storyboard.
- Future integration happens through export bridges, not one shared database.

## Current Status

This repo contains the first minimal app shell and planning documents:

- [Project Book](docs/PROJECT_BOOK.md)
- [MVP Scope](docs/MVP_SCOPE.md)
- [Data Model](docs/DATA_MODEL.md)
- [UX Notes](docs/UX_NOTES.md)
- [Next Tasks](docs/NEXT_TASKS.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Worklog](docs/WORKLOG.md)

## Development

```bash
npm install
npm run dev
npm run build
```

## True v0.1

The true v0.1 should be the smallest capture loop:

1. Open Writer on mobile.
2. Capture one text spark quickly.
3. Save it locally.
4. See it in a recent list.
5. Reopen and edit it.

Image-first thinking remains part of the product philosophy, but image file
capture, voice recording, melody recording, AI help, and export bridges can wait.

## Explicit Non-Goals For Now

- Do not build the full app yet.
- Do not implement AI yet.
- Do not connect to Songbook yet.
- Do not connect to Storyboard yet.
- Do not create shared databases.
- Do not define final import/export formats before the MVP shape is clearer.

## Intended Direction

LassiLAB Writer should become a fast capture and shaping space. It should help an
author catch a spark, attach image or sound memory to it, shape it into words,
and later export selected work to other LassiLAB tools through deliberate bridges.

The first version should prioritize speed, clarity, offline usefulness, and trust.
