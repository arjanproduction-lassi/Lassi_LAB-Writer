# Next Tasks

## Smallest Safe Next Step

The first MVP slice is now implemented:

- Open app on mobile.
- Tap one capture action.
- Save a text spark.
- See it in a recent list.
- Reopen and edit it.
- Export the local Writer DB as JSON.
- Import that JSON on another device.

This proves the core loop and a first manual device bridge without AI, Songbook,
Storyboard, cloud sync, accounts, backends, or shared databases.

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

## Technical Tasks For Later

- Test manual JSON export/import on phone and desktop with real saved sparks.
- Add minimal test setup.
- Add recovery notes for the local import backup key.
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
