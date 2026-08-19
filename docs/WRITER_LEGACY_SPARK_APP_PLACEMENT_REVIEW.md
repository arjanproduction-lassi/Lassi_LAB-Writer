# Writer Legacy Spark App Placement Review

Status: R2.6.3c2b2b3 contract based on published `main` commit
`80692052b213ac2152faac3a74dbef4dee8d8b6c`. The isolated panel and the
import-safe production controller factory are published. The matching App
placement implementation and synthetic checks now implement this contract.
No automated check invokes the production factory or prepare command, and no
real retirement localStorage read has occurred.

## Decision

c2b2b3 places exactly one
`LegacySparkRetirementLocalBackupPanel` in the existing Writer **Dáta / Ručný
prenos DB** section:

1. after all existing manual Writer DB import/export controls and import
   status panels;
2. before the existing Google Drive sync panel;
3. outside the product-shell prototype and without adding navigation, a route,
   a modal, or a second Data surface.

`App.tsx` should pass exactly two values:

- the published function reference
  `createLegacySparkRetirementLocalBackupController`;
- one text-free `LegacySparkRetirementLocalBackupPanelBlockingReason | null`
  derived only from already existing App state.

App must not call the controller factory, controller, c2b1, c2a, Date, or
localStorage for retirement. The panel remains the only owner of the explicit
command boundary. Rendering, mounting, rerendering, effects, timers,
visibility/online listeners, import actions, editor actions, Google actions,
reload, and deployment remain retirement-read-free.

## Current Published Inputs

The placement reuses these published APIs without changing them:

- `LegacySparkRetirementLocalBackupPanel` owns rendering, its private
  interaction/controller reference, command lock, safe view model, start-over,
  cancel, and release-only unmount cleanup;
- `LegacySparkRetirementLocalBackupPanelBlockingReason` already defines exactly
  four external reasons:
  - `writer-db-import-active`;
  - `writer-db-recovery-not-clean`;
  - `google-sync-active`;
  - `editor-or-draft-active`;
- `createLegacySparkRetirementLocalBackupController` is an import-safe
  zero-argument function. Merely importing it or passing its reference does not
  call time or c2a;
- c2b2b2 creates the timestamp and reaches c2a only after the panel accepts an
  explicit `prepareLocalBackup()` command;
- c2a remains the only production owner of lazy localStorage acquisition and
  the three approved `getItem` reads.

No API needs to be widened for App placement. Raw snapshots, sessions, record
IDs, titles, excerpts, notes, storage objects, dependency callbacks, errors,
and Writer data must not become App props or state.

## Exact Current App State Sources

The current `App.tsx` already exposes every state needed for a fail-closed
placement:

- `importPreviewState.status` identifies the active `importing` state;
- `importRecoveryGate.status` is initially `checking` and later becomes
  `clean`, `recoverable`, or `blocked` from the existing recovery inspection;
- `isGoogleSyncBusy` is already true for `authorizing` or `syncing`;
- `editor` identifies any currently open new or existing Spark editor;
- `newSparkDraft` identifies the existing recoverable new-Spark draft state.

c2b2b3 must consume these values only. It must not:

- call `inspectWriterDbImportRecoveryGate()` again;
- acquire storage or reread the draft key;
- consult `googleSyncBusyRef` from the panel;
- flush, save, close, or discard an editor or draft;
- pause, cancel, start, or retry import or Google sync;
- add retirement state to localStorage, App context, reducers, URL, or global
  state.

The existing c2a capture remains the final check of the persisted draft. The
App guard is a fail-closed concurrency guard based on already-known UI state;
it is not a replacement for c2a validation.

## Pure Blocking-Reason Boundary

To keep guard precedence testable without rendering App, the implementation
adds one tiny pure helper module:

`src/legacySparkRetirementAppPlacement.ts`

Recommended input:

```ts
type LegacySparkRetirementAppPlacementState = Readonly<{
  writerDbImportActive: boolean;
  writerDbRecoveryClean: boolean;
  googleSyncActive: boolean;
  editorOrDraftActive: boolean;
}>;
```

Recommended output:

```ts
LegacySparkRetirementLocalBackupPanelBlockingReason | null
```

The helper should be pure, deterministic, synchronous, and input-immutable. It
must not import React, App, storage, recovery runtime, Google Drive, c2a, c2b1,
the production controller factory, browser globals, current time, or
randomness.

Use stable first-match precedence:

1. `writerDbImportActive` -> `writer-db-import-active`;
2. `!writerDbRecoveryClean` -> `writer-db-recovery-not-clean`;
3. `googleSyncActive` -> `google-sync-active`;
4. `editorOrDraftActive` -> `editor-or-draft-active`;
5. otherwise -> `null`.

The precedence affects only which safe message is shown when multiple guards
are true. Every non-null result blocks controller creation and capture.

## App Composition

The App diff contains only:

1. imports for the panel, production controller factory, and pure guard helper;
2. one derived blocking reason from existing state;
3. one panel element at the approved Data location.

Conceptually:

```tsx
const retirementBlockingReason = derive...({
  writerDbImportActive: importPreviewState.status === "importing",
  writerDbRecoveryClean: importRecoveryGate.status === "clean",
  googleSyncActive: isGoogleSyncBusy,
  editorOrDraftActive: editor !== null || newSparkDraft !== undefined
});

<LegacySparkRetirementLocalBackupPanel
  createController={createLegacySparkRetirementLocalBackupController}
  blockingReason={retirementBlockingReason}
/>
```

The implementation matches this composition and passes the production factory
as a reference. It must not write
`createController={createLegacySparkRetirementLocalBackupController()}` and
must not wrap it in an effect, timer, memo that executes it, or startup call.

No new App `useState`, `useRef`, `useEffect`, event listener, callback registry,
storage adapter, or cleanup path is needed. The panel already owns its private
lifecycle and release-only cleanup.

## Guard Semantics

### Writer DB import

Block only while `importPreviewState.status === "importing"`. Read-only file
selection, parsing, preview, stale review, blocked review, and confirmed-ready
states do not write and need not block the retirement panel. Once import starts,
the panel must receive `writer-db-import-active`.

App must not alter the import state machine or import handlers to coordinate
retirement. If import state and a retirement command could change in the same
event turn, the panel's synchronous command lock and latest blocking prop remain
the command boundary; no new cross-subsystem lock is introduced in c2b2b3.

### Recovery

Any status other than `clean` blocks, including initial `checking`,
`recoverable`, and `blocked`. App reuses its existing recovery result and does
not perform another inspection for retirement.

### Google sync

Block while the current App-derived `isGoogleSyncBusy` is true, meaning
`authorizing` or `syncing`. Offline, unavailable, idle, connected, and error
states do not themselves mutate data and do not need a retirement-specific
block. Existing Google handlers, refs, timers, and status messages remain
unchanged.

### Editor and draft

Block whenever `editor !== null` or `newSparkDraft !== undefined`. This includes
an empty new editor, an existing Spark editor, and a recoverable draft. App does
not close, save, flush, or discard anything on behalf of retirement.

## Placement And Presentation

Use the panel's existing `sync-panel`, `data-copy`, `data-actions`, and button
classes. No CSS change is expected. The existing Data section and heading stay
unchanged. Import/export controls remain first, the retirement panel is second,
and Google sync remains last.

The panel's current copy remains truthful: it describes a local read-only
snapshot in memory, not a verified backup or downloadable file. Do not rename
the action to reset, delete, migrate, retire, purge, or finish backup.

There must be exactly one **Pripraviť lokálnu zálohu** button. The existing
manual Writer DB export/import buttons and Google buttons remain unchanged.

## Import-Safety And First-Read Boundary

c2b2b3 makes the panel visible, but it must still cause zero retirement reads
before an accepted click:

- importing App and runtime modules: zero;
- App initialization and render: zero;
- panel render/mount/rerender: zero;
- recovery inspection already owned by Writer DB import: no additional read;
- editor/draft state updates: zero retirement reads;
- Google sync state updates: zero retirement reads;
- blocked button interaction: zero controller creation, time, c2a, or reads;
- start-over, cancel, and unmount before capture: zero reads.

The first real read remains c2b2b4. Publishing or deploying c2b2b3 does not
authorize clicking the button.

## Automated Verification Plan

The c2b2b3 checks use only synthetic booleans and source/isolation inspection.
They do not render App against a real browser profile and must
never invoke the production prepare command.

Pure helper checks should prove:

- all-clear returns `null`;
- each individual guard maps to its exact typed reason;
- recovery `checking`, `recoverable`, and `blocked` all map through the same
  `writer-db-recovery-not-clean` boolean boundary;
- precedence is stable when multiple guards are true;
- repeated equivalent input is deterministic;
- input is not mutated and returned reasons carry no user content;
- source contains no React, browser, storage, recovery, Google, time, network,
  or production capture dependency.

App isolation checks should prove:

- the panel and production factory are imported exactly once into `App.tsx`;
- exactly one panel element exists after import UI and before Google sync;
- the production factory is passed as a function reference and never called by
  App;
- App does not import or call c2a, c2b1, c2b2a, localStorage, or storage keys
  for retirement;
- the four helper booleans derive only from the exact existing App states;
- no new effect, timer, listener, ref, state, route, navigation, CSS, storage
  key, or handler is added for retirement;
- existing Writer DB import/export and Google Drive source regions are
  unchanged except for the insertion boundary between them;
- product shell, `main.tsx`, storage, persistence, recovery, export, Drive, and
  package storage files have zero diff;
- the c2b2b1 45 checks, c2b2b2 42 checks, 735 retirement checks, 284 Writer DB
  checks, product-shell checks, TypeScript, and both builds remain green.

## Manual Review Before Publication

Manual review of c2b2b3 may verify only read-free presentation:

- Data shows exactly one retirement panel in the approved position;
- the button is disabled with the expected safe message for synthetic/existing
  App guard states;
- layout, keyboard focus, and mobile width remain usable;
- no click on an enabled production button is performed.

Do not use real author content in screenshots, logs, fixtures, snapshots, or
committed test artifacts.

## c2b2b4 Gate

The first enabled production click may happen only after:

- c2b2b3 is implemented, reviewed, committed, pushed, and deployed;
- the deployed commit and intended production origin/profile/device are known;
- Writer DB recovery is clean;
- import, Google sync, editor, and draft activity are idle;
- the worktree is clean;
- explicit visible-chat approval is given immediately before the click.

That later click may read only the three existing c2a keys. It still may not
write storage, call Drive/network, create bytes/hash/manifest/Blob/file/download,
retry automatically, or continue to R3.

## Implementation Result

The implementation adds exactly:

- pure `src/legacySparkRetirementAppPlacement.ts` with the reviewed four-boolean
  precedence;
- 41/41 synthetic helper and App source/isolation checks;
- one App-derived blocking reason using only existing state;
- one panel element after Writer DB import UI and before Google sync;
- one retirement-harness import/count entry.

`App.tsx` passes the production controller factory as a reference and never
calls it. It adds no state, effect, ref, timer, listener, handler, storage key,
or direct retirement localStorage access. Automated checks read App source but
do not import, render, mount, or click App. The combined retirement harness
passes 776/776.

The panel is now present in the implementation, but c2b2b4 remains a separate
operational gate. Build, publication, deployment, render, or an enabled button
does not authorize the first real click.

## Out Of Scope

This c2b2b3 slice does not implement or authorize:

- invoking the production controller factory or prepare command;
- any real localStorage/Writer data read;
- any storage write, new key, migration, tombstone, reset, purge, or R3 action;
- Drive/network, backup assembly, hash, manifest, Blob, file, download, or
  verification;
- import/export, recovery, persistence, package storage, or Google sync changes;
- deployment, the first real click, or user-data deletion.

## Go / No-Go For c2b2b3 Final Review

Proceed only if the implementation remains one pure boolean-to-reason helper,
its synthetic checks, one narrow App placement, and isolation/harness wiring.
Stop if it requires modifying the panel, runtime composition, c2a, c2b1,
controller contracts, existing handlers, storage keys, CSS, product shell,
import/export, recovery, persistence, or Google sync.

The next step is final safety review of the exact implementation scope, 41/41
placement checks, 776/776 retirement harness, Writer DB and product-shell
regressions, both builds, and production isolation. Commit and push require
explicit approval. c2b2b4 first real click remains a separate explicit
approval.
