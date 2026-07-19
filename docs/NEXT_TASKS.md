# Next Tasks

## Smallest Safe Next Step

The first MVP slice is now implemented:

- Open app on mobile.
- Tap one capture action.
- Save a text spark.
- See it in a recent list.
- Reopen and edit it.
- Clearly distinguish new spark capture from editing an existing saved spark.
- Move a saved spark between **Iskra**, **Poznámky**, **Dielňa**, and
  **Text OK** as a simple four-notebook state.
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

## Next Product Direction

Writer Package v1 is now the target data direction.

The first code bridge is intentionally small:

- add the `WriterPackage` and `WriterPackageNote` types
- keep `Spark` as the active legacy storage model
- adapt old Sparks into read-only package views
- store Writer Packages under their own local key
- provide a read-only catalog that can show real packages and adapted legacy
  Sparks together
- do not migrate local data automatically
- do not change the Writer DB export/import format yet
- do not change Google Drive sync payloads yet

Next implementation decision:

- design the manual runtime confirmation and success/failure UI contract
  without enabling it, wiring `App.tsx`, or adding an active import action

## Next Technical Slice

Do not start with Google sync or production writes.

First implementation step for Writer DB v2:

1. Add `WriterDbV1`, `WriterDbV2`, and `WriterDb` TypeScript types.
2. Add validators for v1 and v2 envelopes.
3. Add a read-only parser that can identify v1 vs v2 without writing anything.
4. Keep current export/import and Google sync behavior unchanged.

Status: the read-only parser is prepared in `src/writerDb.ts`, a separate
manual Writer DB v2 test export can create and validate v2 payloads, and a
local check harness covers v2 payload behavior. Pure `previewWriterDbImport`
now compares parsed v1/v2 data with explicit local arrays, reports deterministic
counts and warnings, and does not write anything. Pure
`mergeWriterDbInMemory` now rejects blocked previews, merges v1/v2 data into
deeply detached arrays with stable order, and validates the result without
persisting it. Pure `createWriterDbImportBackup` now validates and deep-copies
the complete local Sparks and WriterPackages state for both source versions. An
injected persistence coordinator now covers backup and marker writes,
read-back validation, rollback, and failed-rollback marker retention. A
read-only recovery inspection now diagnoses remaining prepared markers as
`clean`, `recoverable`, or `blocked` without writing, rollback, UI, or runtime
localStorage access. The manual preview and confirmation UX contract is
documented, and the separate read-only file-to-preview shell is prepared
locally with no active import command. A pure execution plan now enforces
preflight first, merges only when ready, and creates a deterministic backup
from the original local collections. Its ready result is still read-only and
does not call persistence or mean that an import completed. A separate
injected-storage coordinator now connects that plan to the existing persistence
coordinator in harness tests only. It returns success only after independently
reading, parsing, and comparing both stored collections. Rollback remains owned
by persistence. Current production v1 import/export and Google Drive sync
remain unchanged.

After that:

1. Specify the manual runtime confirmation and success/failure UI contract,
   but do not enable it yet. Keep App.tsx disconnected and preserve the current
   production v1 importer.
2. Only then plan Google Drive v2 sync rollout.
3. Only after that begin production creation of WriterPackages.
4. Only after packages can travel safely build the new workspace UI.

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
- Design the package detail screen before implementing the PC horizontal
  workspace.
- Design the one-package layered workspace before implementing complex draft
  features.
- Preserve the device roles: mobile = chytit, sync = preniest, PC = upratat,
  tablet = citat a tvarovat.

## Technical Tasks For Later

- Test manual JSON export/import on phone and desktop with real saved sparks.
- Test Google Drive sync PC -> mobile -> tablet and back with real sparks.
- Test editing the same spark across PC and mobile; confirm newer `updatedAt`
  wins and no duplicate spark appears.
- Test four-notebook stage changes across PC and mobile; confirm newer
  `updatedAt` wins and the stage travels through sync/export/import.
- Keep extending Writer DB checks before enabling any production v2 import
  writes.
- Test the future production import wiring against failures before the Spark
  write, between Spark and WriterPackage writes, and during rollback.
- Keep recovery inspection headless, without recovery UI, automatic rollback,
  production storage wiring, or Google Drive v2 sync until an explicit manual
  recovery design exists.
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
