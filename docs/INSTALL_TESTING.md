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
