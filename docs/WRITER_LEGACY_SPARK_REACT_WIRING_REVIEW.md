# Writer Legacy Spark React Wiring Review

Status: R2.6.3c2b2b review with c2b2b1 published at
`340f8335ba1d1a68f9b180a66c946728addb9a7c`. The published c2b2a
headless controller exists at `ae998764637075bf8bc341255903af23ce762232`.
The c2b2b2 production composition is published at
`a2f246c4a9aad335b2dbd0b04a907043216d3b02`. This document defines the
production React boundary around those layers. The c2b2b1 slice adds only an
injected, isolated React panel and synthetic checks;
it does not change `App.tsx` or CSS, call the production c2a wrapper, read real
localStorage or Writer data, or create a backup, hash, manifest, Blob, download,
commit, push, or deployment.

## Decision

The future UI must remain a thin view over the published c2b2a controller. It
may expose one explicit **Pripraviť lokálnu zálohu** command in an isolated
retirement subsection of the existing Writer **Dáta / Ručný prenos DB** area.
Rendering, mounting, entering the Data area, importing modules, effects,
timers, listeners, retries, and application startup must remain read-free.

Only an accepted user click may lazily create the controller and issue exactly
one `prepareLocalBackup()` command. React receives only the controller's frozen,
text-free view model. The captured snapshot and c2b1 session remain outside
React state, props, context, reducers, logs, and rendered output.

c2b2b1 implements the isolated injected component and synthetic interaction
boundary. c2b2b2 implements the import-safe production composition. c2b2b3 now
implements the pure guard and one App placement without invoking the factory.
The first real production click remains
behind a later explicit visible-chat approval after the implementation is
reviewed, published, and the worktree is clean.

## Verified Published Boundaries

The future wiring builds on these existing boundaries:

- c2a exposes an import-safe browser wrapper. Merely importing it does not
  acquire `window.localStorage` or read any key. An explicit wrapper call is
  required.
- c2b1 owns the one-shot capture session. Timestamp creation and capture happen
  only inside `prepareLocalSnapshot()`.
- c2b1 keeps raw snapshot references in its closure and exposes only text-free
  public state. `release()` removes the session's retained references.
- c2b2a owns UI-command serialization and maps c2b1 public state to a frozen,
  text-free view model.
- c2b2a `prepareLocalBackup()` is the only capture command. `startOver()`
  releases the old session and creates a new side-effect-free session;
  `dispose()` releases the active session.
- `App.tsx` currently contains no import or use of c2a, c2b1, or c2b2a.

Existing Writer DB import recovery checks, import execution, normal Spark
editing, autosave, and Google sync are separate production behaviors. The
retirement UI must not reuse, call, pause, retry, or modify those behaviors.

## Why The React Step Must Stay Split

Combining a new component, production browser composition, App placement, and
the first real click in one change would make it harder to prove which action
caused the read. c2b2b should therefore remain reviewable as four gates:

1. **c2b2b1 — injected React panel.** Add an isolated component tested only with
   a synthetic controller factory. Do not import it into `App.tsx`; do not
   import c2a; do not read browser storage.
2. **c2b2b2 — import-safe production composition.** Add a small factory that
   composes c2b2a, c2b1, the canonical timestamp adapter, and c2a. Importing or
   creating the factory must still read nothing; only the later controller
   command may call c2a.
3. **c2b2b3 — App placement.** Place the reviewed panel once in Writer Data and
   pass only the production factory plus text-free blocking state. Existing
   import/export and Google sync handlers stay unchanged.
4. **c2b2b4 — manual first-real-click gate.** After separate final review,
   publication, and a clean worktree, request explicit approval before the
   first click against the intended production origin and browser profile.

No earlier gate authorizes a later one. In particular, publishing c2b2b1 or
c2b2b2 does not authorize App wiring or a real storage read.

## Future File Ownership

Recommended future ownership is deliberately narrow:

- `LegacySparkRetirementLocalBackupPanel.tsx` owns only rendering, accessibility,
  one command handler, a controller ref, and the text-free view model.
- `legacySparkRetirementLocalBackupRuntime.ts` owns only production dependency
  composition. It must be import-safe and have no automatic invocation.
- `App.tsx` owns only placement and derivation of text-free, fail-closed blocking
  state from already existing application state.
- the published c2b2a controller continues to own command serialization,
  status/reason mapping, `startOver()`, and `dispose()`.
- c2b1 continues to own the raw in-memory snapshot and one-shot capture
  lifetime.
- c2a continues to own lazy acquisition of browser localStorage and the three
  approved read-only key accesses.

Do not copy controller transitions or reason mapping into React. Do not pass a
c2b1 session, c2a result, raw strings, parsed records, IDs, titles, excerpts,
notes, or content-bearing errors through React state.

## React Ownership Contract

The panel may hold only:

- a private controller reference, initially `null`;
- the latest frozen c2b2a view model, or `null` before the first command;
- a synchronous, non-content-bearing command lock used to reject re-entry;
- presentation-only focus/visibility state when needed for accessibility.

The controller reference must not be React state. The raw c2b1 session and
captured snapshot are reachable only through the controller's private closure.
React may never retain or clone them.

The initial `null` view state renders approved static copy and the single
**Pripraviť lokálnu zálohu** button. It must not create a controller merely to
obtain a `ready` view model. This preserves the stronger rule that component
render and mount do not even create a session.

Creating a controller is permitted only inside the accepted click handler.
Controller creation itself must remain side-effect-free: no timestamp, c2a,
`window`, localStorage, storage key read, network request, hash, or download.

## Production Dependency Composition

The future production composition layer may inject exactly these c2b1
dependencies:

- `createCanonicalTimestamp()`: obtain the current time only while handling the
  accepted click, normalize it to the existing canonical UTC second format
  ending in `.000Z`, and return no user content;
- `captureLocalSnapshot({ createdAt })`: call the published
  `captureLegacySparkRetirementBrowserLocalStorageSnapshot({ createdAt })` once.

Neither dependency may run while the module loads, while the factory is
created, while App renders, or while the panel mounts. The timestamp must not be
created earlier and cached. The runtime layer adds no random ID, transaction
marker, storage key, persistence, logging, analytics, or fallback read path.

The c2a wrapper remains the sole production localStorage acquisition boundary.
The composition layer must not access `window.localStorage` directly and must
not call `getItem`, `setItem`, `removeItem`, or `clear` itself.

## Explicit Click Sequence

One accepted **Pripraviť lokálnu zálohu** click should perform this sequence
synchronously from the UI command boundary:

1. Re-evaluate the latest external blocking reason.
2. Reject the command without creating a controller if blocked.
3. Acquire a synchronous command lock before any controller work.
4. Lazily create exactly one controller if the private ref is empty.
5. Call `prepareLocalBackup()` exactly once.
6. Store only the returned frozen, text-free view model in React state.
7. Release the command lock in a `finally` boundary.
8. Stop. Do not automatically continue to Drive, hashing, assembly, verification,
   file creation, download, retry, or R3.

A rejected click means zero controller creation, zero timestamp calls, zero c2a
calls, and zero storage reads. A double-click, keyboard repeat, or re-entrant
handler invocation must still produce at most one controller command and one
capture attempt for that session.

## Fail-Closed App Guards

The App placement may pass one text-free blocking reason derived from existing
state. The retirement button should be disabled when any of these are true:

- Writer DB import is actively `importing`;
- Writer DB recovery inspection is not `clean`, including checking,
  `recoverable`, or `blocked` states;
- Google authorization or sync is actively running;
- a Writer editor or recoverable draft is currently active;
- the retirement command lock is already held.

These guards prevent a deliberately started capture from competing with an
already known operation that may change the same data. They do not authorize
the retirement UI to inspect recovery storage, flush or discard a draft, save
an editor, stop a timer, pause sync, sign out, alter import state, or mutate any
existing subsystem.

The c2a capture remains the final prerequisite check. If the persisted draft
key is non-empty, c2a/c2b1 returns the existing incomplete result. The UI must
not pre-read that key, hide the reason, delete the draft, or retry automatically.

If an external guard changes after a command finishes, the completed session
result remains truthful for the moment it was captured. A later consistency
reread belongs to R2.6.3d, not React wiring.

## Placement In App

If c2b2b3 is later approved, place exactly one isolated subsection:

- inside the existing Writer **Dáta / Ručný prenos DB** screen;
- after the existing manual Writer DB import/export controls;
- before the existing Google Drive sync panel;
- outside the product-shell prototype and production navigation structure;
- without moving, renaming, or changing existing import/export or sync actions.

Use existing Data-area visual patterns first. CSS changes are not part of the
smallest wiring step and require separate justification if existing styles are
insufficient. The operation must not be presented as a finished backup or as a
Spark retirement/reset action.

## UI States And Truthful Copy

The panel should remain intentionally small:

- before the first command: explain that the action is local and read-only and
  does not download a file;
- `preparing`: show a neutral progress message and disable the command;
- `snapshot-ready`: say only that the local snapshot is prepared in memory and
  that later backup stages are not connected;
- `incomplete`: preserve the controller's specific text-free reason, including
  the draft prerequisite;
- `invalid`: preserve the controller's safe invalid reason without displaying
  parser input, record IDs, titles, excerpts, notes, or raw errors;
- `released`: state that the in-memory session was released and require a new
  explicit start before another attempt.

`snapshot-ready` must never be labelled `backup-verified`, `assembly-verified`,
downloaded, synchronized, restorable, or safe for deletion. No state in c2b2b
authorizes tombstones, reset, purge, migration, or package-only cutover.

The main button label remains exactly **Pripraviť lokálnu zálohu**. Status
updates should use an accessible labelled region with polite announcements.
Keyboard activation must follow the same single-command lock as pointer input.

## Start Over, Cancel, And Unmount

The future UI must keep the existing controller lifecycle:

- `startOver()` is available only in the controller-defined terminal states;
- it releases the previous c2b1 session, creates a fresh side-effect-free
  session, and returns to ready without timestamp creation or capture;
- cancel calls `dispose()`, clears the controller ref, clears the public view,
  and returns the panel to its initial not-started presentation;
- component unmount calls `dispose()` once when a controller exists and clears
  the ref.

No controller/session creation or capture may run from `useEffect`. A cleanup
effect may only call `dispose()` to release already existing in-memory
references. Cleanup must not create a replacement session, update storage,
retry capture, or continue a workflow.

JavaScript cannot guarantee physical memory wiping. The contract is removal of
application-held references and no content-bearing copies in React or logs.

## Privacy And Side-Effect Boundary

Before the approved click, there is no retirement data read. After the click,
the captured raw values remain local and closure-held in memory. The future
panel and runtime composition add none of the following:

- storage writes or mutation of captured values;
- a new persistent storage key;
- Drive, network, analytics, telemetry, clipboard, or error-reporting content;
- console output containing raw strings, IDs, titles, excerpts, notes, or
  creative text;
- Writer DB bytes, hash, manifest, Blob, file, download, or backup verification;
- merge, normalization, repair, migration, tombstones, reset, purge, or R3.

The only approved c2a reads remain:

- `lassilab-writer:v0.1:sparks`;
- `lassilab-writer:v0.1:packages`;
- `lassilab-writer:v0.1:draft:new-spark`.

No other storage key may be introduced or inspected by this phase.

## Automated Verification Plan

c2b2b1 synthetic component checks should prove:

- importing, rendering, mounting, rerendering, and entering the visible panel
  create no controller and read nothing;
- one accepted pointer or keyboard click creates one controller and issues one
  `prepareLocalBackup()` command;
- blocked, double-clicked, repeated, and re-entrant commands issue no second
  controller call;
- the button is disabled while a command is active;
- React receives only the frozen text-free view model;
- no raw snapshot/session/dependency object enters props, state, context,
  rendered markup, errors, snapshots, or logs;
- incomplete and invalid reasons remain specific and text-free;
- `startOver()` updates from the returned view model without capture;
- cancel and unmount release exactly once and leave no controller ref;
- no automatic retry or later-stage continuation exists;
- mobile width, keyboard focus, label association, and status announcements
  remain usable without changing the wider Data screen.

c2b2b2 composition checks should use injected browser/storage/time adapters and
prove:

- module import, factory creation, controller creation, and `getViewModel()`
  read nothing and create no timestamp;
- only `prepareLocalBackup()` reaches c2a;
- one command reads exactly the three approved keys through `getItem` only;
- no `setItem`, `removeItem`, `clear`, Drive/network, crypto, Blob, or download
  path exists;
- the timestamp is created once during the command and has canonical `.000Z`
  form;
- the returned public state is text-free and the raw snapshot remains internal.

c2b2b3 App isolation checks should prove:

- exactly one retirement panel is placed in the intended Data location;
- existing Writer DB import/export and Google handlers are unchanged;
- the product shell, `main.tsx`, storage modules, Drive modules, persistence,
  recovery, and export formats are unchanged;
- each external blocking state prevents factory creation and capture;
- App does not call c2a, c2b1, or localStorage directly for retirement;
- render, mount, effects, timers, listeners, autosave, sync, import, and reload
  do not invoke the retirement command.

All automated checks use synthetic strings and throwing sentinels. They must
not read a real browser profile, snapshot real author data, or commit content.

## Manual Gate Before The First Real Click

The first real production click remains a separate operational authorization,
not an automated test. It may happen only after c2b2b implementation is
separately reviewed, committed, pushed, deployed as intended, and the worktree
is clean. Ask for explicit visible-chat approval immediately before the click.

Before approval, confirm:

- the intended production origin, browser profile, and device are open;
- no Writer editor is open and no unsaved/draft work is being discarded;
- Writer DB recovery is clean and no import is active;
- Google authorization/sync is idle;
- the reviewed commits are the deployed commits;
- developer logging/recording will not expose content;
- the click can only read the three approved keys and cannot write or download.

After the approved click, verify only text-free facts: one accepted command,
expected safe status/reason/count metadata, no storage writes, unchanged raw
localStorage values, no network request, no download, and no automatic next
step. Do not print, paste, screenshot, snapshot-test, or commit creative text or
raw storage values.

## Go / No-Go For Future c2b2b3

Proceed with App placement only when all of these are proven:

- the React panel is already covered by synthetic read-free lifecycle tests;
- production composition is import-safe and c2a is reachable only through the
  accepted controller command;
- raw snapshot/session state never crosses into React;
- fail-closed App guards are text-free and do not modify other subsystems;
- one gesture maps to one command and double-click maps to no second command;
- cancel/unmount release retained references;
- existing import/export, Google sync, storage keys, recovery, persistence, and
  product shell remain behaviorally unchanged.

Stop if any render, mount, effect, factory creation, import, retry, or unrelated
App action can reach c2a, time creation, or localStorage.

## Local c2b2b1 Status

c2b2b1 is published as:

- `LegacySparkRetirementLocalBackupPanel.tsx`, an isolated component with an
  injected c2b2a controller factory;
- a lazy, text-free interaction closure that creates the controller only inside
  an accepted prepare command;
- one synchronous command lock, explicit start-over/cancel actions, and
  release-only unmount cleanup that remains safe under React Strict Mode;
- four fail-closed external blocking reason types without importing App state;
- static, human-readable messages and safe aggregate counts only;
- 45/45 synthetic checks covering lazy creation, blocked/repeated/re-entrant
  commands, lifecycle release, exception redaction, server rendering,
  accessibility, and forbidden runtime dependencies.

The component is not imported by `App.tsx`, `main.tsx`, or the product shell.
It does not import c2a, storage, Google sync, recovery, persistence, time,
randomness, network, crypto, Blob, FileReader, or download APIs. Rendering and
server rendering create only the text-free interaction wrapper, not the c2b2a
controller or c2b1 session. No real localStorage or Writer data was read.

## Out Of Scope

This review and the c2b2b2 composition do not implement or authorize:

- App wiring, CSS, route, or activation;
- a real localStorage read or first click;
- Drive raw GET, sync changes, or multi-device propagation;
- Writer DB v2 byte creation, raw Drive bytes, hashing, assembly, verification,
  manifest, Blob, file, or download;
- R2.6.3d consistency reread;
- tombstones, reset, purge, migration, package editing, merge, recovery changes,
  export-format changes, or R3;
- commit, push, deploy, or deletion of any data.

## Smallest Safe Next Step

The c2b2b2 import-safe injected/production controller factory module passes
42/42 synthetic checks and 735/735 combined checks. c2b2b3 imports it into
`App.tsx` only as a function reference, and automated checks do not invoke its
production prepare path. The c2b2b3 contract in
`WRITER_LEGACY_SPARK_APP_PLACEMENT_REVIEW.md` is now implemented as one pure
guard helper, 41 synthetic/isolation checks, and one narrow App placement. The
first real click remains c2b2b4 and requires another explicit approval.
