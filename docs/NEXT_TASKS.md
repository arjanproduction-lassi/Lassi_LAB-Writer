# Next Tasks

## Smallest Safe Next Step

The first MVP slice is now implemented:

- Open app on mobile.
- Tap one capture action.
- Save a text spark.
- See it in a recent list.
- Reopen and edit it.
- Clearly distinguish new spark capture from editing an existing saved spark.
- Export the local Writer DB as JSON.
- Import that JSON on another device.
- Connect Google Drive when `VITE_GOOGLE_CLIENT_ID` is configured.
- Manually sync the hidden Drive DB across PC, mobile, and tablet.
- Keep Svitok enabled locally after Google connect.
- Mark local saves/deletes as pending sync changes.
- Quietly sync after save/delete when a valid Google access token is already
  active in memory.
- Try quiet sync on app open and on foreground return when Svitok is enabled and
  the access token is already active in memory.
- Show offline and waiting-for-Google states without interrupting writing.
- Autosave an unsaved new spark into a local recovery draft.
- Offer **Obnoviť** / **Zahodiť** when a local draft is found on return.

This proves the core loop, a manual JSON bridge, and an experimental manual
Google Drive bridge without AI, Songbook, Storyboard, full background sync,
custom accounts, backends, or shared databases.

## Repository Setup Tasks

- Confirm this folder is the intended Git worktree.
- Add a license if needed.
- Add a simple project decision log if planning decisions start changing.
- Choose the first frontend stack only when implementation begins.
- Add contribution notes only if more than one person will work here soon.

## Product Definition Tasks

- Define the first capture flow.
- Confirm that v0.1 starts with text-only spark capture.
- Define what counts as a spark.
- Decide the minimum local persistence approach for the first prototype.
- Decide whether `originHint` belongs in v0.1 or waits until the next slice.

## Design Tasks

- Sketch mobile-first capture screen.
- Sketch recent sparks list.
- Sketch spark detail.
- Sketch the image-first prompt language without implementing image upload.
- Design the "four notebooks" workspace model before implementing complex draft
  features.
- Preserve the device roles: mobile = chytit, sync = preniest, PC = upratat,
  tablet = citat a tvarovat.

## Technical Tasks For Later

- Test manual JSON export/import on phone and desktop with real saved sparks.
- Test Google Drive sync PC -> mobile -> tablet and back with real sparks.
- Test editing the same spark across PC and mobile; confirm newer `updatedAt`
  wins and no duplicate spark appears.
- Tune the quiet sync interval if real PC/mobile use shows it is too eager or
  too slow.
- Consider a gentle sync-on-open pull only if Google can do it without a popup
  or token persistence.
- Test draft recovery on Android after closing the installed app, browser tab,
  and browser process.
- Keep manual sync as the safety fallback even as Svitok becomes quieter.
- Add minimal test setup.
- Add recovery notes for the local import backup key.
- Add recovery notes for the local sync backup key.
- Add export bridge design notes for future Songbook or Storyboard handoff.
- Add accessibility checks for the capture flow.

## Not Yet

- Do not implement AI.
- Do not connect to Songbook.
- Do not connect to Storyboard.
- Do not create shared databases.
- Do not add image upload yet.
- Do not add voice or melody recording yet.
- Do not add Kováč yet.
- Do not add Songbook or Storyboard export bridges yet.
- Do not turn the manual Writer DB JSON file into a final public export schema.
- Do not turn experimental Google Drive sync into automatic background sync yet.
