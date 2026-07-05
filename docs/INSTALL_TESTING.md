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
- Environment Variables: none required for v0.1

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

Before each import, Writer stores a local backup copy under:

```text
lassilab-writer:v0.1:sparks:backup-before-import
```

This backup is local to the current browser and can be overwritten by the next
import.

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
