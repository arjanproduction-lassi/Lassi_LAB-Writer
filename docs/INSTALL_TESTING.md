# Install And Testing

## Scope

This guide is only for running, building, previewing, and deploying the current
LassiLAB Writer v0.1 shell.

It does not add AI, Kováč, voice recording, melody recording, image upload,
Songbook or Storyboard integration, accounts, sync, collaboration, or export
bridges.

## Run Locally On Desktop

From the project folder:

```bash
cd C:\Users\Peter\Projects\Lassi_LAB-Writer
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173/
```

Use this for fast development testing.

## Build Locally

```bash
npm run build
```

Expected result:

- TypeScript checks pass.
- Vite creates a production build in `dist/`.

## Run Writer DB Checks

Writer DB v2 has a small local check harness. It does not use production UI,
does not import data through the app, does not write runtime localStorage, and
does not change Google Drive sync.

```bash
npm run check:writer-db
```

Expected result:

- The command exits with code 0.
- The summaries report 174 checks total: 66 parser/export, import-preview,
  in-memory merge, and backup-factory checks; 21 injected persistence
  coordinator checks; 20 read-only recovery inspection checks; 15 pure
  file-to-preview preparation checks; 16 pure confirmation preflight checks;
  10 pure preview UI transition checks; and 26 pure import execution checks.
- Empty, Sparks-only, WriterPackages-only, mixed, tombstone, count mismatch,
  invalid JSON, unsupported schema, and corrupted record scenarios are checked.
- Preview checks cover v1 Packages untouched, newer/equal/older timestamps,
  v2 package comparison, warnings, duplicate-id blocking, immutability, and no
  localStorage access.
- Merge checks cover blocked preview rejection, stable ordering, tombstone
  decisions, missing records, whole-package replacement, deep copies, result
  validation, and no localStorage access.
- Backup checks cover complete two-model snapshots, source versions, canonical
  time, tombstones, nested data, invalid inputs, duplicate ids, deep-copy
  isolation, and no localStorage access.
- Persistence checks cover injected backup and marker writes, read-back
  validation, rollback, failed rollback marker retention, and no real
  localStorage access.
- Recovery checks cover `clean`, `recoverable`, and `blocked` results, warning
  cases, blocking backup/marker damage, and read-only behavior.
- Preparation checks cover ready and blocked v1/v2 results, warnings, input
  immutability, and no localStorage access.
- Preflight checks cover recovery blocking, fresh ready/stale/blocked preview
  results, deterministic comparison, v1 Packages untouched, tombstones, input
  immutability, and no localStorage access.
- Preview UI checks cover confirmed-ready, stale refreshed preview, renewed
  readiness checks, recovery and preview blocking, no import action, and reset
  to idle.
- Execution checks cover strict preflight ordering, v1/v2 merge rules,
  original-state backup creation, deterministic time, real merge and backup
  failures, deep-copy isolation, repeatability, and absence of storage or
  persistence side effects.
- No production storage write, production import, export, UI, or Google Drive
  sync change is performed.

## Writer DB Pure Import Execution Checks

`prepareWriterDbImportExecution` calculates a future import plan without
executing it. Preflight must be ready before merge and backup creation. Stale
or blocked results stop immediately. On ready, the backup is created from the
original local arrays while the merged arrays are returned separately.

The helper does not call the persistence coordinator, write a transaction
marker, touch browser storage, or produce a success summary. A ready result
therefore confirms only a prepared in-memory plan, not a completed import.

## Writer DB Import Preview Checks

Pure `previewWriterDbImport` is implemented for local checks, but it is not
connected to production import or UI. It receives a successfully parsed DB and
local arrays as inputs. It does not read or write localStorage, merge records,
create a backup, or change its inputs.

Current automated checks cover:

- v1 previews Sparks while WriterPackages report `untouched` with zero changes
- v2 previews Sparks and WriterPackages independently
- newer, equal, and older `updatedAt` values map to update, unchanged, and
  ignored-older counts
- tombstones follow the same timestamp rule and do not imply hard deletion
- missing incoming ids leave local records unchanged
- count mismatch and cross-model id overlap remain informational warnings
- duplicate ids inside one incoming collection block import
- WriterPackages are compared as whole records by top-level `updatedAt`; notes
  are not evaluated as individual merge units
- preview does not touch localStorage or mutate incoming data, local arrays, or
  nested notes

The preview checks now feed the pure in-memory merge checks below. The planned
unified backup key, rollback, transaction marker, and preview UI remain
documentation only and are not created by the current runtime or checks.

## Writer DB In-Memory Merge Checks

Pure `mergeWriterDbInMemory` is not connected to production import. It accepts
the same explicit parsed DB and local arrays as preview, returns a discriminated
success or failure result, and persists nothing.

Current checks confirm:

- blocked previews return `ok: false` without merging
- v1 merges only Sparks and returns Packages with unchanged content
- v2 merges Sparks and WriterPackages independently
- newer records replace local records at their existing positions
- equal and older records preserve local content and position
- new records, including new tombstones, append in incoming order
- missing incoming ids do not delete local records
- newer active records can replace older tombstones and vice versa
- same ids across models preserve both records
- Packages replace as whole records by top-level `updatedAt`
- returned arrays, Spark tags, Package notes, and legacy metadata are detached
  from incoming and local inputs
- invalid records, invalid `packageVersion`, and duplicate result ids return
  `ok: false`
- localStorage is never read or written

The persistence checks below cover the guarded write coordinator. It remains
disconnected from production import and UI.

## Writer DB Import Backup Factory Checks

Pure `createWriterDbImportBackup` is not connected to production import or
storage. It returns either a validated, detached backup or a clear error.

Current checks confirm:

- `backupVersion` is `1` and `reason` is `before-import`
- source schema versions 1 and 2 are preserved
- v1 and v2 backups both contain complete local Sparks and WriterPackages
- default `createdAt` is current canonical ISO and optional `now` is deterministic
- tombstones, stage, tags, notes, deleted notes, workshop/final text, and legacy
  metadata are preserved
- invalid time, source schema, Spark, Package, `packageVersion`, and duplicate
  same-collection ids return `ok: false`
- backup arrays and nested values are detached from inputs in both mutation
  directions
- localStorage is never read or written

The planned unified backup key remains disconnected from production runtime.
Save/load backup, prepared transaction marker, rollback, and guarded writes are
covered only by injected checks until a later UI/import slice explicitly wires
them in.

## Test The Production Build Locally

After a successful build:

```bash
npm run preview
```

Open the preview URL printed by Vite, usually:

```text
http://localhost:4173/
```

Use this to test the built `dist/` output before deploying.

## Install Locally From The Production Preview

After starting `npm run preview`, open the preview URL in Chrome or Edge on
desktop. Use the browser install option, usually shown as **Install app**,
**Create shortcut**, or an install icon in the address bar.

The app should install as **LassiLAB Writer**, separate from Songbook and
Storyboard.

## Deploy On Vercel From GitHub

Do not use local tokens for this project setup. Use the Vercel dashboard GitHub
import flow.

1. Push the latest `main` branch to GitHub.
2. Open Vercel.
3. Choose **Add New...** then **Project**.
4. Import `arjanproduction-lassi/Lassi_LAB-Writer`.
5. Confirm the project settings below.
6. Deploy.

Vercel supports Git-based deployments and creates deployments from connected
Git repositories. See the official Vercel docs:

- https://vercel.com/docs/git
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/project-configuration

## Expected Vercel Settings For Vite

Use these settings when importing the GitHub repository:

- Framework Preset: `Vite`
- Root Directory: project root
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Development Command: `npm run dev`
- Environment Variables:
  - none required for the local text-spark loop or manual JSON export/import
  - optional for experimental Google Drive sync:
    `VITE_GOOGLE_CLIENT_ID`

The repository also includes a minimal `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Test On Android Phone Or Tablet

After Vercel deploys:

1. Open the Vercel deployment URL on the Android device.
2. Tap **⚡ Nová iskra**.
3. Enter a short text spark.
4. Save it.
5. Confirm it appears in **Posledné iskry**.
6. Reopen it.
7. Edit it and save again.

## Test New Spark Draft Recovery

Draft recovery protects only a new unsaved spark. It is local to the current
browser and is not part of Google sync or manual DB export/import.

Basic recovery:

1. Open Writer.
2. Tap **⚡ Nová iskra**.
3. Type a short unfinished thought.
4. Wait about one second so autosave can run.
5. Refresh the page or close and reopen the app.
6. Confirm Writer shows **Našiel som rozpísanú iskru.**
7. Tap **Obnoviť**.
8. Confirm the unfinished text returns to the editor.

Discard:

1. Create an unsaved draft as above.
2. Refresh or reopen Writer.
3. Tap **Zahodiť**.
4. Confirm the recovery card disappears and the draft does not return after
   another refresh.

Save clears draft:

1. Restore or type a new draft.
2. Tap **Uložiť iskru**.
3. Refresh Writer.
4. Confirm the saved spark appears in **Posledné iskry** and no recovery card
   appears for that same text.

## Test Existing Spark Editing

Editing an existing spark is a deliberate save, not draft recovery.

Basic edit:

1. Save a new spark.
2. Open it from **Posledné iskry**.
3. Confirm Writer says the existing spark is being edited.
4. Change the text.
5. Tap **Uložiť zmeny**.
6. Confirm the same spark appears once in **Posledné iskry** with the changed
   text.

Metadata and sync:

1. Export the DB before and after the edit if you need to inspect JSON.
2. Confirm the edited spark keeps the same `id`.
3. Confirm `createdAt` stays the same.
4. Confirm `updatedAt` changes to the edit time.
5. Confirm Writer marks local changes for sync or quietly syncs if Google is
   connected.

Cancel edit:

1. Open an existing spark.
2. Change the text.
3. Tap **Zrušiť úpravu**.
4. Reopen the spark and confirm the original saved text is unchanged.
5. Confirm the new-spark draft recovery card was not created from the edited
   text.

## Test Four Notebooks Stage

The four notebooks are one optional `stage` field on a saved spark. They are not
separate databases.

Basic stage flow:

1. Save a new spark.
2. Confirm the card shows **Iskra**.
3. Open the spark from **Posledné iskry**.
4. In **Zošit**, change **Iskra** to **Poznámky**.
5. Confirm the card badge changes to **Poznámky**.
6. Repeat with **Dielňa** and **Text OK**.
7. Move it back to **Iskra** to confirm mistakes can be undone.

Filters:

1. Use the filters **Všetko**, **Iskry**, **Poznámky**, **Dielňa**, and
   **Text OK**.
2. Confirm the spark appears only in its current notebook and also in
   **Všetko**.
3. Confirm an empty notebook shows a calm empty state.

Metadata and sync:

1. Export the DB before and after changing **Zošit** if you need to inspect JSON.
2. Confirm the spark keeps the same `id`.
3. Confirm `createdAt` stays the same.
4. Confirm `updatedAt` changes when stage changes.
5. Confirm the exported JSON includes `stage` for staged sparks.
6. Import or sync the DB on another device and confirm the stage travels.

Backward compatibility:

- Older sparks without `stage` should still load.
- Writer treats missing `stage` as **Iskra**.
- Editing an older spark or changing its stage should not create a duplicate.

## Test Manual DB Export And Import

The v0.1 JSON DB bridge is manual and file-based. It is not cloud sync.

From desktop to phone:

1. Open Writer on desktop.
2. Save one or more sparks.
3. Tap **Exportovať DB**.
4. Confirm the downloaded filename looks like
   `LassiLAB_Writer_DBv001_YYYY-MM-DD.json`.
5. Send or copy that JSON file to the phone.
6. Open Writer on the phone.
7. Tap **Importovať DB** and choose the JSON file.
8. Confirm the import result shows added, updated, and skipped/invalid counts.
9. Confirm imported sparks appear in **Posledné iskry**.

From phone to desktop:

1. Export the DB on the phone.
2. Move the JSON file to the desktop.
3. Import it in the desktop browser.
4. Reopen a spark and confirm the newest edit wins when the same spark `id`
   exists on both devices.

Delete bridge:

1. Open an existing spark.
2. Tap **Zmazať iskru**.
3. Confirm the browser prompt.
4. Confirm the spark disappears from **Posledné iskry**.
5. Export the DB.
6. Import that DB on another device.
7. Confirm the deleted spark does not reappear.

Deletes are sync-safe soft deletes. Writer stores `deletedAt` and updates
`updatedAt`; the hidden tombstone remains in the DB export so the delete can
travel to other devices.

Before each import, Writer stores a local backup copy under:

```text
lassilab-writer:v0.1:sparks:backup-before-import
```

This backup is local to the current browser and can be overwritten by the next
import.

## Test Experimental Google Drive Sync

Google Drive sync is experimental. Manual **Synchronizovať teraz** remains the
safety fallback, but Writer can now try a quiet sync on app open, on return to
the app, and after save/delete/import when the Google access token is already
active in memory. It is not full automatic background sync, not Gmail email
transport, and not a shared database.

Required setup before testing on Vercel:

1. Create or open a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen.
4. Add the non-sensitive Drive scope:
   `https://www.googleapis.com/auth/drive.appdata`.
5. Create an OAuth Client ID with type **Web application**.
6. Add the production origin:
   `https://lassi-lab-writer.vercel.app`.
7. Add local development origins if needed, for example:
   `http://localhost:5173`.
8. Copy the OAuth Client ID.
9. In Vercel, add:
   `VITE_GOOGLE_CLIENT_ID=<client-id>`
10. Redeploy the Vercel project.

Test PC -> mobile:

1. Open Writer on PC.
2. Save a spark.
3. In **Dáta**, tap **Pripojiť Google** and approve access.
4. Tap **Synchronizovať teraz** once, or save/edit the spark again while Google
   is connected and confirm Writer waits briefly, then shows a quiet sync
   status.
5. Open Writer on the Android phone with the same Google account.
6. Tap **Pripojiť Google** if the phone has not connected in this browser
   session.
7. Tap **Synchronizovať teraz**.
8. Confirm the PC spark appears on the phone.

Test mobile -> PC:

1. Save a new spark on the phone.
2. If Google is already connected in the current phone session, confirm Writer
   tries quiet sync after save. If not, tap **Synchronizovať teraz**.
3. Tap **Synchronizovať teraz** on PC.
4. Confirm the phone spark appears on PC.

Test app open:

1. Connect Google and sync once.
2. Save another spark while the same page session is still active.
3. Reload or reopen the app.
4. If the access token is still active in memory, Writer may sync quietly.
5. If the token is gone, confirm Writer does not open a Google popup and shows
   that Svitok is waiting for Google connection.

Test return to app:

1. Save or edit a spark while Google is connected.
2. Switch away from Writer, then return to the tab or installed app.
3. Confirm Writer tries quiet sync only if changes are waiting or the last sync
   is stale.

Test offline:

1. Turn off network access.
2. Save a spark.
3. Confirm Writer shows **Offline** and says changes are stored locally.
4. Turn network access back on.
5. If the token is still active, Writer may sync quietly. If not, it waits for
   **Pripojiť Google** or **Synchronizovať teraz**.

Test pending local changes:

1. Disconnect by closing/reopening the browser or wait until Google requires a
   fresh token.
2. Save a spark.
3. Confirm Writer keeps the spark locally and shows that local changes are
   waiting for sync.
4. Tap **Pripojiť Google** or **Synchronizovať teraz**.
5. Confirm pending changes clear after successful sync.

Conflict rule:

- Writer merges by spark `id`.
- If the same spark exists on both devices, newer `updatedAt` wins.
- A deleted spark uses `deletedAt` plus a newer `updatedAt`, so the delete wins
  over older undeleted copies.
- Older copies do not overwrite newer copies.
- Before a sync merge, Writer stores a local backup under:

```text
lassilab-writer:v0.1:sparks:backup-before-sync
```

If `VITE_GOOGLE_CLIENT_ID` is missing, Writer must still build and run. The
Google sync controls should be disabled with a short setup message.

Writer stores only non-secret sync preferences in `localStorage`. It must not
store access tokens, refresh tokens, client secrets, or the OAuth client ID.

Google popup rule:

- A Google popup may open only after an explicit user action such as
  **Pripojiť Google** or **Synchronizovať teraz**.
- Quiet sync must not open Google by itself while the author is writing.

## Writer DB Persistence Checks

Run:

```text
npm run check:writer-db
```

The persistence checks use an injected in-memory storage double. They cover
write order, backup and marker read-back validation, Sparks and WriterPackages
read-back validation, rollback, failed rollback marker retention, tombstones,
tags, notes, legacy metadata, and input immutability.

The persistence coordinator is not connected to the production import button,
the current export/import contract, real localStorage keys, or Google Drive
sync. Recovery from a remaining transaction marker is not automatic.

## Writer DB Recovery Inspection Checks

Run:

```text
npm run check:writer-db
```

The recovery inspection checks use injected storage only. They cover:

- no marker -> `clean`
- valid marker plus compatible valid backup -> `recoverable`
- damaged marker, missing backup, damaged backup, unsupported backup version,
  duplicate backup ids, and source-schema mismatch -> `blocked`
- damaged or unreadable current Sparks/WriterPackages -> `recoverable` with
  warnings when the backup is still valid
- target Spark/Package count mismatch -> warning only
- no `setItem`, no `removeItem`, no real `window.localStorage`, no marker
  cleanup, no rollback, and no automatic repair

## Future Manual Import UX Acceptance

The read-only file-to-preview shell is implemented as a separate action in the
Data section. Import execution is still not connected. Verify on both PC and
mobile that:

1. Selecting a file only reads, parses, and previews it; storage, backup,
   import, sync, and recovery remain untouched.
2. **Zrušiť** from a ready preview leaves all data byte-for-byte unchanged.
3. Invalid JSON, unsupported schema, damaged records, and duplicate ids inside
   one collection show a blocked preview with no **Importovať** action.
4. A ready preview shows separate Iskra and Tvorivý balík counts, stable
   warnings, and the sentence **Výber súboru zatiaľ nič nezmenil.**
5. v1 clearly reports that WriterPackages remain untouched.
6. Confirmation reloads fresh local collections and recomputes preview. A
   changed preview returns to review without backup, merge, or storage writes.
7. Success counts match the validated stored result and confirm backup
   creation.
8. Failures distinguish no production write, successful rollback, and failed
   rollback without exposing stack traces.
9. A recoverable or blocked transaction marker prevents a new import before
   file selection; no automatic recovery runs.
10. PC can use two count columns. Mobile uses one vertical panel with reachable
    actions and no horizontal table or zoom requirement.

While import execution remains disconnected, keep the existing production
import/export, storage keys, Google Drive sync, and recovery runtime wiring
unchanged.

The pure preparation helper adds 15 checks to `npm run check:writer-db` for a
total of 122. They cover valid v1/v2 previews, parser failures, damaged records,
duplicate same-collection ids, every warning family, input immutability, and no
localStorage access.

## Add To Home Screen On Android

In Chrome on Android:

1. Open the Vercel URL.
2. Tap the three-dot menu.
3. Tap **Add to Home screen** or **Install app** if Chrome offers it.
4. Confirm the name.
5. Launch Writer from the home screen icon.

The installed Android app should use the Writer name and icon. It is still a
separate app from Songbook because it is served from its own Vercel project URL.

## Storage Warning

The v0.1 app stores sparks in `localStorage`.

This means:

- Sparks are stored only on the current browser and device.
- A new unsaved spark draft is also stored only on the current browser and
  device until it is saved or discarded.
- Sparks do not automatically sync between desktop, phone, or tablet.
- JSON export/import is the first manual bridge between devices.
- Clearing browser data can delete saved sparks.
- A Vercel deployment does not create a shared database.
- Importing a JSON file does not create accounts, cloud storage, or backend
  sync.

## PWA Status

This is a minimal installable PWA shell.

The app includes a manifest, Writer icons, and a small service worker for the
static app shell. Full offline behavior beyond the current local text-spark
workflow remains future work.
