# Project Book

## One-Line Summary

LassiLAB Writer is a mobile-first PWA workshop for capturing and shaping poems,
lyrics, voice sparks, images, fragments, melodies, and ideas before they vanish.

## Core Belief

The author is always the creator. The tool exists to protect attention, memory,
and momentum. AI can assist later, but it must never become the center of the
creative act.

## Product Principles

- Faster than forgetting: capture must be immediate, especially on mobile.
- First comes the image, then the word: visual sparks are treated as first-class
  creative material, not attachments after the fact.
- Every spark has value: Writer should not decide which early fragment matters.
- Sparks before documents: rough fragments are welcome and should not be forced
  into polished forms too early.
- Workshop, not oracle: future AI helper Kováč should behave like a tool on the
  bench, not an author, judge, or replacement voice.
- Independent systems: Writer, Songbook, and Storyboard keep separate data
  stores.
- Bridges over shared databases: integration happens through explicit export
  and import paths.

## Creative Materials

Writer should eventually support:

- Poems
- Lyrics
- Voice sparks
- Melody sparks
- Images
- Ideas
- Lines
- Fragments
- Drafts
- Notes around mood, memory, place, and intent

## Boundaries

This repository should not start with a complex architecture. The foundation
should remain simple until product behavior proves what is needed.

Current boundaries:

- Documentation and planning only.
- True v0.1 is a single local text-spark capture loop.
- No AI implementation.
- No Songbook integration.
- No Storyboard integration.
- No shared database.
- No final synchronization model.
- No final export contract.
- No voice or melody recording in the first implementation unless explicitly
  chosen later.
- No image file management in the first implementation unless explicitly chosen
  later.

## Future Shape

The likely future product shape is:

1. Capture quickly on mobile.
2. Organize sparks into small creative objects.
3. Shape fragments into drafts.
4. Add optional support from Kováč.
5. Export selected work to Songbook, Storyboard, files, or other destinations.

Each step should remain useful on its own.
