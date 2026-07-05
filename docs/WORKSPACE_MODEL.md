# Workspace Model

## Core Idea

LassiLAB Writer should feel like the author's old 3-4 notebook workflow, not
like a database admin panel.

The comfort to preserve:

- one place catches sparks fast
- one place keeps fragments and context
- one place can be messy while shaping text
- one place holds the clean accepted version

This is a workspace model, not a request to implement complex draft features
yet.

## Four Notebooks

### 1. Iskra

Purpose: capture before the thought disappears.

Rules:

- fastest possible capture
- no organizing pressure
- mobile-first
- faster than forgetting

The author should not need to decide where the spark belongs. The app should
catch it first and let structure come later.

### 2. Poznamky

Purpose: expand without needing a finished text.

May contain:

- image or image memory
- mood
- fragments
- phrases
- rhymes
- context
- loose associations

This space is allowed to be incomplete. It exists because many sparks need a
little air before they become a draft.

### 3. Dielna / Rozpracovane

Purpose: shape text.

This is where the author can:

- try versions
- cross out
- move lines
- restructure
- compare directions
- keep rough work visible without pretending it is clean

This space should be friendly on tablet and strong on desktop.

### 4. Text OK

Purpose: keep the accepted version clean.

The clean text must be separated from messy drafts because the old third
notebook became too crossed out and confusing. Writer should protect the relief
of having one clear version that is safe to read, copy, or continue from.

## Device Roles

- Mobile = chytit.
- Sync = preniest.
- PC = upratat.
- Tablet = citat a tvarovat.

### Mobile

Mobile is the net for sparks:

- quick capture
- quick continuation
- minimal decisions
- no organizing burden

The main mobile action must remain fast capture.

### Tablet

Tablet is the reading and shaping bench:

- comfortable reading
- medium editing
- trying shape and flow
- continuing text without full desktop weight

### PC / Desktop

PC is the main workbench:

- organizing
- merging
- cleaning
- versioning
- separating draft noise from accepted text

Organization can be richer on PC than on mobile.

## Bridge Principle

Sync or another bridge is essential because a spark captured on mobile must be
able to wait safely for PC or tablet later.

The product is for one author across multiple devices. It is not multi-user
collaboration.

## Future Implementation Order

1. Google Drive Svitok sync.
2. Autosave rozpisanej iskry.
3. Jemny status iskry: Iskra / Poznamky / Dielna / Text OK.
4. Only then build deeper editors for notes and versions.

This order protects the author's real workflow: first catch safely, then move
between devices, then avoid losing unfinished writing, then add structure.

## UX Guardrails

- Mobile must never become an organizing burden.
- Comfort of writing is as important as technical storage.
- The interface should feel like a friendly work table.
- Status should be gentle, not bureaucratic.
- Draft features should not arrive before the workspace model is designed.
