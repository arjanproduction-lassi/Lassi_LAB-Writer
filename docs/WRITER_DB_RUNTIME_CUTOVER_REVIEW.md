# Writer DB Final Runtime Cutover Review

Status: design and safety review only. This document does not authorize a
runtime change by itself. The cutover must be implemented, tested, reviewed,
committed, and published as one separate task.

The currently published runtime is still read-only on the new preview and
readiness path. It does not call `executeWriterDbImport`, does not expose the
new active **Importovať databázu** confirmation action, and still keeps the
legacy production importer unchanged. Everything below describes a future
cutover, not completed runtime behavior.

## Objective

Replace the legacy production `importWriterDb(parsed)` route with the already
prepared coordinated Writer DB v1/v2 route in one atomic runtime change. After
the cutover there must be one file-selection flow, one authoritative
`WriterDbImportUiState`, and exactly one active **Importovať databázu** action.
There must never be two production import implementations available at once.

## Required One-step Replacement

The cutover commit must make all of these user-reachable changes together:

1. Remove or disable the active legacy `Importovať DB` button, its writable
   hidden file input, and its reachable handler binding before enabling the new
   action. `importInputRef`, `openImportPicker`, and `handleImportDb` must no
   longer form a second user-reachable write path.
2. Keep the current read-only file picker, parser, preview, readiness, semantic
   revision, and state-machine path as the only route into import confirmation.
3. Label the file-selection entry as a non-destructive choice such as
   **Vybrať databázu na import**. It opens the picker but does not import.
4. Render exactly one active **Importovať databázu** button only when the
   authoritative state is `import-confirm-ready`.
5. Do not render or retain any second import action in the Data section, hidden
   input path, keyboard shortcut, or fallback handler.

This replacement must be reviewed as a single diff. Do not first enable the
coordinated action while leaving the legacy importer reachable.

### Mandatory cutover versus optional dead-code cleanup

The activation commit must remove or disable the active legacy UI path and
activate only the coordinated Writer DB v1/v2 path. It must be impossible for
two buttons, two writable file inputs, two handlers, or another fallback to
start two different production imports.

Deleting the now-unused internal `importWriterDb` API, its old App import, old
types, helpers, or legacy result messages is optional cleanup. If that cleanup
would enlarge the activation diff or increase risk, defer it to a separate
follow-up commit. The internal legacy API may temporarily remain as unreachable
dead code, but it must not remain available through a second active user path.

## Confirmation and Single-execution Lock

The confirmation handler must use the published state machine and adapter:

1. Read the current `confirmedRevision` from `import-confirm-ready`.
2. Call `requestWriterDbImportStart(state, confirmedRevision)` synchronously.
3. If the transition is rejected, preserve the original state, run no
   coordinator, and expose no technical stack trace.
4. If accepted, commit the `importing` state before starting coordinator work.
5. While `importing`, disable file selection, close/reset, readiness, and the
   import button. A second click must not call the coordinator.

The transition result, not an independent React boolean, owns permission to
start. The coordinator invocation count for one confirmation must be exactly
one. `executeWriterDbImport` may be called only after
`requestWriterDbImportStart` returned `{ accepted: true }` and its returned
state is `importing`. A rejected transition means zero coordinator calls and no
fallback state replacement.

## Final Recovery Gate

Readiness is not permanent authority. Immediately before coordinator execution,
the handler must:

1. reload fresh Sparks and real WriterPackages;
2. run `inspectWriterDbRecovery` through an injected get-only storage view;
3. pass that fresh recovery inspection and the confirmed preview to
   `executeWriterDbImport`.

Required outcomes:

- `clean` may continue through the coordinator;
- `recoverable` must return `recovery-required` before merge, backup, or write;
- `blocked` must return `recovery-blocked` before merge, backup, or write.

The cutover must not add recovery UI, automatic repair, automatic rollback,
marker deletion, or startup recovery authority. A non-clean marker remains a
blocking state that requires a separately reviewed recovery flow.

## Reload and Recovery Authority

React `importing` state is not authoritative after a reload. Every new Writer
open or reload must begin by running `inspectWriterDbRecovery` before the UI
allows another import or claims a terminal result. The persisted transaction
marker, interpreted by recovery inspection, is the authority for `clean`,
`recoverable`, or `blocked`.

- The UI must not infer success or failure from React state that existed before
  reload.
- `clean` with no marker does not retroactively turn an unverified import into
  success. Success still requires the coordinator's completed read-back result.
- `recoverable` or `blocked` forbids a new import.
- An unresolved marker remains blocking until a separately reviewed recovery
  flow resolves it; the UI and coordinator must not delete it.
- `beforeunload` may warn that an operation is in progress. It must not claim
  that closing or reloading safely cancelled the transaction.

## State Machine to Coordinator Wiring

The only permitted execution chain is:

```text
import-confirm-ready
  -> requestWriterDbImportStart
  -> importing
  -> executeWriterDbImport (once, with injected dependencies)
  -> applyWriterDbCoordinatorResult
  -> success | preview-stale | preview-blocked | failed
```

## Exact `executeWriterDbImport` Inputs

The future call must use the real `ExecuteWriterDbImportInput` API. Do not add
an App-specific parallel input model.

### A. Values from the confirmed-ready UI state

- `db: WriterDb` comes from `state.db`.
- `previousPreview: WriterDbImportPreview` receives
  `state.confirmedPreview`. The coordinator API is named `previousPreview`; the
  UI state field is named `confirmedPreview`.

Both values must come from the same accepted `import-confirm-ready` state whose
`confirmedRevision` was accepted by `requestWriterDbImportStart`.

### B. Fresh local data

- `currentLocalSparks: readonly Spark[]` is loaded immediately before the
  coordinator call through the existing complete Spark loader.
- `currentLocalPackages: readonly WriterPackage[]` is loaded immediately before
  the coordinator call through the existing real WriterPackage loader.

Do not reuse arrays captured when the original file preview was created.

### C. Fresh read-only recovery inspection

- `recoveryInspection: WriterDbRecoveryInspection` is produced immediately
  before execution by `inspectWriterDbRecovery` using an injected
  `Pick<WriterDbKeyValueStorage, "getItem">` view.

### D. Runtime-generated values

- `backupCreatedAt: string` is one canonical timestamp created immediately
  before the import in the thin runtime layer.
- `transactionCreatedAt: string` is one canonical timestamp created in that
  same thin runtime layer for the transaction marker and verification.
- `transactionId: string` is one unique, opaque transaction identity created in
  that same thin runtime layer.

### E. Existing injected storage and keys

- `storage: WriterDbKeyValueStorage` is the existing injected production
  key-value adapter exposing the `getItem`, `setItem`, and `removeItem` methods
  required by the persistence coordinator. App must not perform those writes
  directly.
- `keys: WriterDbPersistenceKeys` uses the existing `sparks`, `packages`,
  `backup`, and `transaction` fields. The existing persistence/recovery values
  are `lassilab-writer:v0.1:sparks`, `lassilab-writer:v0.1:packages`,
  `lassilab-writer:v0.1:writer-db:backup-before-import`, and
  `lassilab-writer:v0.1:writer-db:import-transaction`.

The runtime layer must reuse those keys and must not create a new storage key.

## Thin Runtime Generation Contract

`backupCreatedAt`, `transactionCreatedAt`, and `transactionId` are created only
in the thin App/runtime orchestration layer immediately before the accepted
import execution. Pure preview, revision, preflight, execution-plan, state
machine, adapter, backup, recovery, and merge modules must not read the current
time or generate identity implicitly.

`transactionId` must be unique and opaque. It must not contain the selected file
name, Spark text, WriterPackage title, any other user text, an email address, an
access token, credential, secret, or other sensitive value. This review defines
the safety contract only; it does not choose an ID-generation implementation.
Generating these values does not authorize a new storage key.

Do not call `mergeWriterDbInMemory`, backup creation, or persistence directly
from App. `executeWriterDbImport` remains the single owner of execution order,
and the persistence coordinator remains the single owner of marker writes and
rollback.

## Coordinator Result Mapping

Every coordinator result must pass through `applyWriterDbCoordinatorResult`.
App must accept the returned state only when the transition is accepted.

### Success

- Reach `success` only after coordinator read-back validation succeeds.
- Show Writer DB version, Spark and WriterPackage summary counts, and confirmed
  backup creation from the typed success result.
- Reload visible Sparks from persisted storage only after success.
- **Hotovo** resets through `resetWriterDbImportUi` and clears the file input.

### Stale

- Compute a new semantic revision from `refreshedPreview`.
- Map the result to `preview-stale` with that explicit revision.
- Write nothing and require a new readiness check and confirmation.

### Blocked

- Preserve the concrete reason: `recovery-required`, `recovery-blocked`,
  `preview-blocked`, `merge-failed`, or `backup-failed`.
- Show human copy and never claim that an import succeeded.
- Merge and backup failures must still produce no persistence call.

### Failed

- Preserve `stage`, `persistenceStage`, rollback facts, error, and
  `transactionMarkerRemaining` exactly as returned.
- Use the state machine's derived safe-close rule. Do not recreate it in App.
- Verification failure, failed rollback, remaining marker, or unknown marker
  state must not be silently reset to idle.
- Show calm recovery guidance without a stack trace or automatic repair.

## Google Drive Boundary

Google Drive sync stays on its current v1 contract during this cutover:

- do not change `googleDriveSync.ts`, its remote file, schema, merge rules,
  token handling, or Drive storage behavior;
- do not add WriterPackages to Google Drive sync;
- do not describe imported WriterPackages as synced across devices;
- only after verified import success, preserve the existing
  `markLocalChangesForSync()` behavior when the Spark summary reports a real
  Spark change; a package-only import must not schedule or imply Package sync;
- preserve the existing Spark-only sync behavior separately from the Writer DB
  v1/v2 local import transaction.

Google Drive DB v2 sync requires its own later design, failure tests, and
publication gate.

## Out of Scope

The runtime cutover must not add, remove, or change any of the following:

- automatic Spark to WriterPackage migration;
- automatic deletion of legacy Sparks after a WriterPackage is created;
- per-note merge behavior;
- WriterPackage catalogue rules;
- tombstone rules;
- `updatedAt` merge rules;
- the manual export format without a separate explicit decision;
- the Google Drive v1 remote file or its format;
- Google Drive v2 sync;
- the Spark editor;
- the WriterPackage editor;
- draft autosave or draft recovery;
- sync behavior beyond preserving the existing Google Drive v1/Sparks-only
  contract described above;
- unrelated content, copy, layout, or visual changes.

These boundaries also forbid using the cutover as an automatic data migration
or cleanup project.

## Protected Boundaries

The cutover must not introduce:

- new localStorage keys;
- a second backup or rollback implementation;
- direct marker writes in App;
- automatic migration;
- recovery UI or automatic recovery;
- changes to Writer DB export;
- changes to Google Drive sync;
- `.env`, `.vercel`, `dist`, secrets, tokens, or credentials.

## Runtime Return Point

The last published safe read-only runtime baseline before activation is:

`24c6b71311ba89d5ce2b12d762a8332691fb351e`

At that runtime commit:

- the new preview/readiness path is read-only;
- App.tsx does not call `executeWriterDbImport`;
- the new active **Importovať databázu** confirmation button does not exist;
- the legacy import remains unchanged.

A later documentation commit may make repository HEAD newer, but it does not
change this runtime baseline. Before activation, the cutover plan and release
notes must name this exact return point and identify the single activation
commit that can be reverted.

If the future cutover fails any go/no-go gate, do not patch it hurriedly with a
chain of additional production changes. Revert the activation commit or return
the runtime files to this last safe read-only baseline, then investigate in a
separate reviewed change.

## Required Test Matrix

Before publication, extend the Writer DB harness and verify at minimum:

1. the active legacy button, writable input, and reachable handler are absent or
   disabled before the coordinated action is enabled;
2. exactly one active import action and one writable file path exist, and the
   action appears only in `import-confirm-ready`;
3. accepted `requestWriterDbImportStart` enters `importing` synchronously and a
   double-click calls `executeWriterDbImport` exactly once;
4. a rejected start preserves state and calls the coordinator zero times;
5. successful v1 import updates Sparks, reports `packagesUntouched`, and leaves
   WriterPackages content unchanged;
6. successful v2 import persists and independently verifies both collections;
7. stale immediately before import writes nothing, returns `refreshedPreview`,
   creates a new semantic revision, and requires readiness again;
8. fresh recovery `recoverable` returns `recovery-required` and prevents every
   merge, backup, and persistence call;
9. fresh recovery `blocked` returns `recovery-blocked` and prevents every merge,
   backup, and persistence call;
10. merge/backup blocking performs no persistence;
11. a persistence failure before rollback is needed reports no rollback and
    never becomes success;
12. a persistence failure with successful rollback reports the rollback,
    restored state, and marker truthfully, but never presents a successful
    import;
13. a persistence failure with failed rollback reports failure and leaves or
    truthfully reports the transaction marker according to the actual
    persistence result;
14. neither coordinator nor UI deletes the marker or performs a second
    rollback; rollback remains persistence-owned;
15. verification failure after persistence never becomes success, even if the
    marker is already absent;
16. while state is `importing`, attempts to **Zavrieť**, **Zrušiť**, reset, or
    select a new file are rejected, do not replace state with an App fallback,
    and do not call the coordinator again;
17. reload before marker creation starts with recovery inspection and does not
    use old React state as proof of success;
18. reload after marker creation but before writes reports the marker through
    recovery inspection and blocks a new import;
19. reload after a partial write reports `recoverable` or `blocked` from the
    persisted transaction evidence and performs no automatic recovery rollback;
20. reload after successful persistence but before React success still begins
    with recovery inspection and does not invent success without coordinator
    read-back evidence;
21. every new Writer open runs recovery inspection before enabling import, and
    every unresolved marker blocks another import;
22. success is emitted only after coordinator read-back validation and only then
    reloads visible Sparks;
23. safe terminal reset and same-file selection still work through the state
    machine;
24. the active legacy import button no longer exists after cutover, regardless
    of whether unreachable internal legacy API cleanup was deferred;
25. Google Drive v1/Sparks-only sync remains functional and its files, remote
    format, and behavior have no unintended diff;
26. all 269 existing checks plus the new cutover checks pass;
27. production builds pass normally and with empty `VITE_GOOGLE_CLIENT_ID`;
28. no new storage key, export-format change, migration, per-note merge, or
    sensitive artifact enters the cutover.

Also run `npm run check:writer-db`, both production builds, `git diff --check`,
an explicit staged-file review, protected-file diffs, and a sensitive-artifact
audit before committing.

## Manual Acceptance

On PC and mobile, verify valid v1, valid v2, stale, recovery-required,
recovery-blocked, duplicate-id blocked, persistence rollback, unsafe failure,
success, close/reset, and same-file reselection. Confirm that the UI never
offers two import actions and never shows success before independent read-back.

## Go / No-go Decision

Proceed only if the implementation can remove or disable the active legacy UI
route and enable the coordinated route in one reviewed activation commit with
the full test matrix passing.

The cutover is explicitly **NO-GO** if any of these are true:

- an active legacy import remains;
- two import buttons or two file inputs capable of writes remain;
- `executeWriterDbImport` can be called without an accepted transition into
  `importing`;
- recovery blocking is absent or can be bypassed;
- success can be displayed without coordinator read-back validation;
- reload can bypass or ignore the transaction marker;
- any of the 269 existing checks or any new cutover check fails;
- the normal build or the build with empty `VITE_GOOGLE_CLIENT_ID` fails;
- Google Drive v1/Sparks-only sync changes unintentionally;
- a new storage key appears without a separate explicit decision.

If the active legacy route must remain available, the coordinated action must
remain disabled.
