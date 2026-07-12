# UX Notes

## UX North Star

Writer must be faster than forgetting.

The first screen should help the author capture, continue, or revisit work
without making them choose a complex structure first.

## Four Notebook Comfort

Writer should recreate the comfort of the author's old 3-4 physical notebook
workflow without forcing the physical mess into a database-shaped UI.

The product model is:

1. **Iskra**
   - Fastest possible capture.
   - No organizing pressure.
   - Mobile-first.
   - Faster than forgetting.
2. **Poznámky**
   - Image, mood, fragments, phrases, rhymes, and context.
   - A place to expand the spark without needing a finished text.
   - The author can add material before knowing what it is.
3. **Dielňa / Rozpracované**
   - Shaping text.
   - Trying versions.
   - Crossing out, moving, restructuring.
   - Desktop and tablet friendly.
4. **Text OK**
   - Clean accepted version.
   - Separated from messy drafts because the old third notebook became too
     crossed out and confusing.

The goal is not to create four heavy admin categories. The goal is to preserve
the psychological comfort of separate spaces: catch, expand, shape, accept.

## Device Roles

- Mobile = chytiť.
- Sync = preniesť.
- PC = upratať.
- Tablet = čítať a tvarovať.

Mobile is the net for sparks, quick capture, quick continuation, and minimal
decisions. It must never become an organizing burden.

Tablet is the reading and shaping bench. It should feel comfortable for medium
editing, comparing, and continuing text without the weight of the full desktop
workspace.

PC/Desktop is the main workbench for organizing, merging, cleaning, versioning,
and separating accepted text from draft noise.

Sync or another bridge is essential because a spark captured on mobile must be
able to wait safely for PC or tablet later.

## Keep-Like Svitok Comfort

The author's desired feeling is close to Google Keep: write, close, continue
later on another device without performing technical rituals.

Writer should not make the author think like a database admin. The comfort rule:

- Mobile = chytiť.
- Sync = preniesť.
- PC = upratať.
- Tablet = čítať a tvarovať.

Google Drive Svitok is the first bridge for this. Manual sync remains as a
safety fallback, but the long-term direction is quiet sync on open and after
save whenever Google allows it without interrupting the author.

Tichý Svitok v2 moves closer to that feeling:

- Try sync on app open if Svitok is enabled and an access token is still active
  in memory.
- Try sync when returning to the app if local changes are waiting or the last
  sync is stale.
- Debounce sync briefly after save/delete/import so Writer does not sync on
  every tiny action.
- Show offline and waiting states calmly: the author can keep writing because
  local save is the first safety layer.

Tokens must not be stored. If Google needs fresh consent or an expired token
must be renewed, Writer should continue locally, show a calm waiting state, and
let the author reconnect intentionally.

Quiet sync never means opening a Google popup without a user action.

## Draft Recovery Comfort

Autosave for a new unsaved spark protects the most fragile moment: the author is
still thinking, has not committed the text, and a refresh, accidental close, or
mobile interruption could lose the idea.

The recovery UX should feel like a quiet note on the table:

- Save the new spark draft locally while typing.
- Show "Našiel som rozpísanú iskru" on return.
- Let the author choose **Obnoviť** or **Zahodiť**.
- Clear the draft after the spark is saved.
- Keep the draft local only; it is not synced and not part of export/import.

## Workspace UX Rules

- Main mobile action remains fast capture.
- Organization can be richer on PC than on mobile.
- The product is for one author across multiple devices, not multi-user
  collaboration.
- Comfort of writing is as important as technical storage.
- The app should feel like a friendly work table, not a database admin panel.

## Future UX Order

The next larger UX steps should happen in this order:

1. Google Drive Svitok sync.
2. Autosave rozpisanej iskry.
3. Gentle spark status: Iskra / Poznámky / Dielňa / Text OK.
4. Only then build deeper editors for notes and versions.

This protects the real workflow: catch first, move safely between devices,
avoid losing unfinished writing, then add structure.

## Mobile-First Priorities

- One large, obvious capture action in v0.1.
- Minimal typing before saving.
- Autosave or save-without-thinking behavior.
- Recent sparks available immediately.
- Works well with one hand.
- No layout that depends on desktop width.
- Offline-friendly behavior from the beginning if technically practical.

## First Comes The Image

Images should feel like starting points for writing.

For v0.1, this can be expressed through language and prompts rather than image
file handling. The app can ask what the author saw, heard, felt, or remembered.

Later possible flows:

- Capture image, then write.
- Choose existing image, then write.
- Start a fragment from an image detail.
- Keep image and text visible together when shaping a draft.

## Voice And Melody Sparks

Voice sparks and melody sparks are core future concepts. The UX should leave room
for them, but they should not be visible as unfinished controls in v0.1.

Future capture actions may include:

- Record voice spark.
- Record melody spark.
- Add quick transcript or note.
- Link audio spark to draft.

## Kováč UX Principle

Kováč is a future helper, not the author.

When AI is eventually introduced, it should be framed as optional workshop help:

- sharpen
- question
- suggest
- compare
- transform
- translate
- continue only when asked

It should not imply ownership, replacement authorship, or automatic completion.

## Screen Concepts

Potential early screens:

- Capture: quick text spark entry.
- Recent: latest sparks.
- Spark detail: saved spark plus edit state.

Later screens:

- Image-first capture.
- Voice or melody capture.
- Draft editor.
- Export bridge.

## UX Risks

- Too many categories before capture.
- Too much setup before writing.
- AI controls visible too early.
- Desktop-first layouts that feel heavy on mobile.
- Treating image, voice, or melody as attachments instead of creative origins.
