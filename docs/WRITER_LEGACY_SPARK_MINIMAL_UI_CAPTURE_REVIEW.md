# Writer Legacy Spark Minimal UI Capture Review

Status: R2.6.3c2b2 docs-only review. This document designs the smallest future
user-gesture UI wiring for local capture. It implements no React/UI runtime,
does not import c2b1 into App, does not call c2a, reads no real localStorage or
Writer data, and creates no Writer DB bytes, Drive request, hash, manifest,
Blob, download, commit, push, or deployment.

Published prerequisite: R2.6.3c2b1 is published at
`315b24b695113ff1dcc8c6f633428e483b100c02`. It provides the pure
`createLegacySparkRetirementLocalCaptureSession(...)` one-shot session with 45
synthetic checks and no browser/runtime storage access.

## UI Inventory

The old Writer app owns the operational Data area in `src/App.tsx`. The current
section is labelled **Dáta / Ručný prenos DB** and already contains:

- manual Writer DB v1 export;
- manual Writer DB v2 test export;
- one coordinated Writer DB import flow;
- a hidden file input used only by the import picker;
- recovery-gate messages for unfinished import transactions;
- read-only import preview/status cards;
- Google Drive sync in a separate `sync-panel`.

The existing visual and interaction patterns are enough for a small future
retirement subsection:

- `data-section` is the section owner;
- `data-actions` groups command buttons;
- `data-action` is the primary Data-area button style;
- `ghost-action` is the safe cancel/close action style;
- `data-note` carries text-free status;
- `import-preview` and `import-preview-blocked` provide framed status panels;
- `sync-panel` shows how to separate a sensitive sub-flow from the import
  controls without mixing handlers.

There is no separate Data component today; the current controls are inline in
`App.tsx`. A future implementation should add an isolated retirement backup
subsection inside the existing Data area, after the manual import/export group
and before Google Drive sync. It must not reuse the existing import file input,
import preview state machine, import persistence runtime, or Google sync
handlers.

The Product shell and read-only Library prototype are not the owner for this
operation. They are read-only/prototype surfaces and must not become the first
real localStorage capture entrypoint.

Important current App behavior: existing `useEffect` calls already inspect
Writer DB import recovery and register normal app listeners. c2b2 must not add
retirement capture, timestamp creation, c2a invocation, or localStorage reads to
render, import, mount, `useEffect`, timers, visibility handlers, or sync paths.

## Minimal Architecture

Use three layers and keep raw data out of React state.

### A. Sensitive Session Closure

A future service/controller layer may own a c2b1 session reference in a closure
or a React `useRef`. It is responsible for:

- creating the c2b1 session with injected dependencies;
- ensuring `prepareLocalSnapshot()` is called only by the explicit click
  command;
- providing c2a capture as an injected dependency only for that command path;
- holding any successful raw snapshot inside c2b1 only;
- calling `release()` when the flow is cancelled, reset, unmounted, or ended.

Session creation is safe only because c2b1 creation has no side effects. Still,
the future service should avoid constructing production storage dependencies in
render. The production c2a wrapper may be referenced by a separately reviewed
composition layer, but the first call to it must remain inside the explicit
click command.

### B. Text-Free View Model

The view model exposes only frozen public state derived from c2b1:

- published guide state;
- safe `createdAt`;
- text-free counts and storage statuses;
- typed command and guide reasons;
- lifecycle flags such as preparing/released;
- `nextAllowedStep`.

It must not expose raw snapshot objects, raw JSON, Spark or Package IDs, Spark
text, Package title/layers, note text, draft text, bytes, Storage objects,
dependency callbacks, exception text, stack traces, Drive identifiers, account
data, or download artifacts.

### C. Minimal React UI

The future React UI should be a small isolated subsection under Data:

- one explicit **Pripraviť lokálnu zálohu** button;
- short local/read-only copy;
- one text-free status area;
- a cancel/`START_OVER` action that calls `release()`;
- no file picker, Drive action, download, import, or destructive control.

React state may store only the text-free public state and simple UI lifecycle
flags. Raw snapshot capability remains in the service/session closure. Do not
put `withCapturedSnapshotForInternalUse` in props, reducer actions, browser
events, localStorage/sessionStorage, URL/history, logs, analytics, or error
reporting.

## User-Gesture Contract

Before the user clicks **Pripraviť lokálnu zálohu**, none of these may happen:

- c2b1 `prepareLocalSnapshot()`;
- timestamp creation;
- c2a capture call;
- `window.localStorage.getItem`;
- Writer DB byte creation;
- Drive or network request;
- hash, manifest, Blob, download, or file picker.

The click handler may do exactly one command:

1. ensure one active session exists or create a new one;
2. call `prepareLocalSnapshot()` once;
3. update React state only with the returned text-free public state.

The button is disabled while a command is active. A double-click, reentrant
call, or parallel click must result in one accepted command at most and a typed
rejection such as `CAPTURE_ALREADY_IN_PROGRESS`; it must not create a second
timestamp or second capture.

## First Real Read Manual Gate

This docs-only review does not authorize a real click. The first real
localStorage read requires a later explicit visible-chat approval after the
future c2b2 implementation is separately reviewed, committed, pushed, and the
worktree is clean.

Before that first real click:

- confirm the production domain and browser profile;
- confirm no unreviewed App/UI/runtime diff is present;
- confirm the button is the only capture trigger;
- confirm render, mount, import, and effects read nothing;
- confirm DevTools/network audit is ready;
- confirm storage-write audit is ready;
- confirm only the Spark, Package, and Draft keys can be read;
- confirm UI output is text-free;
- confirm no Drive, fetch, hash, Blob, download, backup, or R3 action can run.

After that first click:

- verify exactly one local capture attempt occurred;
- verify localStorage values are unchanged;
- verify no `setItem`, `removeItem`, or `clear` was called;
- verify no network/Drive call occurred;
- verify no raw author content reached UI/logs.

## Session Lifetime

Prefer `useRef` or a feature-service closure for the sensitive session. React
state receives only frozen text-free public state. The future implementation
must never store raw snapshot data in:

- `useState`;
- props or context;
- reducer actions;
- localStorage/sessionStorage;
- URL/history;
- console output;
- analytics or error reporting.

Call `release()` on:

- user cancel/`START_OVER`;
- leaving the retirement subsection;
- unmount;
- incomplete/invalid terminal capture when no continuation is allowed;
- completion of a later whole backup process;
- any explicit restart before creating a new session.

Release only drops references and returns guide state through published
`START_OVER` when valid. It does not write storage, delete data, create
tombstones, call Drive, call capture, or claim physical memory wiping. The same
released session must not be used for another capture; a new explicit attempt
requires a new session and a new user action.

## Text-Free UI States

Recommended UI states are intentionally small:

- `ready`: show **Pripraviť lokálnu zálohu** and local/read-only copy;
- `preparing`: "Kontrolujem lokálne údaje..." with the button disabled;
- `snapshot-ready`: "Lokálny snapshot je pripravený." plus safe counts/statuses;
- `incomplete`: "Lokálna záloha sa nedá pripraviť, kým je rozpracovaný draft
  alebo chýba bezpečná podmienka.";
- `invalid`: "Lokálne údaje sa nepodarilo bezpečne prečítať.";
- `released`: "Session bola ukončená. Nový pokus vyžaduje nové spustenie.";

Allowed display data:

- guide status;
- safe createdAt;
- Spark/Package/note counts and tombstone counts;
- Spark/Package/Draft storage statuses;
- typed reason codes mapped to safe user text;
- next allowed step.

Forbidden display data:

- raw Spark/Package/Draft JSON;
- Spark text;
- Package title, sparkText, workshopText, finalText, or note text;
- draft text;
- Spark/Package ID lists;
- bytes;
- Storage object;
- exception text or stack trace.

## Error Mapping

All messages are text-free and must not include exception text or author
content.

| Reason | Safe user message |
| --- | --- |
| `LOCAL_STORAGE_UNAVAILABLE` | Lokálne úložisko nie je dostupné. Nič nebolo zmenené. |
| `SPARK_STORAGE_READ_FAILED` | Iskry sa nepodarilo bezpečne prečítať. Nič nebolo zmenené. |
| `PACKAGE_STORAGE_READ_FAILED` | Tvorivé balíky sa nepodarilo bezpečne prečítať. Nič nebolo zmenené. |
| `DRAFT_STORAGE_READ_FAILED` | Rozpracovaný draft sa nepodarilo bezpečne skontrolovať. Nič nebolo zmenené. |
| `INVALID_CREATED_AT` | Čas zálohy nemá bezpečný formát. Skús nový pokus. |
| `CREATED_AT_CREATION_FAILED` | Čas zálohy sa nepodarilo vytvoriť. Nič nebolo zmenené. |
| `CAPTURE_DEPENDENCY_FAILED` | Lokálnu kontrolu sa nepodarilo dokončiť. Nič nebolo zmenené. |
| `DRAFT_PRESENT` | Najprv dokonči alebo zahoď rozpracovanú iskru. |
| `SPARK_STORAGE_PARSE_FAILED` / `SPARK_STORAGE_INVALID` / `DUPLICATE_SPARK_ID` | Iskry v lokálnom úložisku nie sú bezpečne čitateľné. |
| `PACKAGE_STORAGE_PARSE_FAILED` / `PACKAGE_STORAGE_INVALID` / `DUPLICATE_PACKAGE_ID` | Tvorivé balíky v lokálnom úložisku nie sú bezpečne čitateľné. |
| `DRAFT_STORAGE_PARSE_FAILED` / `DRAFT_STORAGE_INVALID` | Rozpracovaný draft nie je bezpečne čitateľný. |
| `CAPTURE_ALREADY_IN_PROGRESS` | Kontrola už prebieha. |
| `CAPTURE_ALREADY_ATTEMPTED` | Tento pokus už skončil. Nový pokus vyžaduje nové spustenie. |
| `CAPTURE_SESSION_RELEASED` | Session bola ukončená. Nový pokus vyžaduje nové spustenie. |
| `GUIDE_TRANSITION_REJECTED` / `INVALID_TRANSITION` | Interný stav nedovoľuje pokračovať. Nič nebolo zmenené. |

No automatic retry is allowed. The user must explicitly start a new session for
a new attempt.

## Future UI Scope

A future c2b2 implementation may only:

- add an isolated subsection in **Dáta / Ručný prenos DB**;
- keep session/raw snapshot in a service closure or ref;
- trigger `prepareLocalSnapshot()` only from the button click;
- display text-free public state;
- call `release()` on cancel, reset, unmount, or end.

It must not:

- change existing import/export behavior;
- create Writer DB bytes automatically;
- call Drive or sync;
- hash data;
- assemble or verify a backup;
- create a manifest;
- use Blob/download/file picker;
- write storage;
- change Sparks or Packages;
- create tombstones;
- start R3.

## Test Plan

Automated tests use synthetic dependencies only:

- importing the feature reads nothing;
- rendering reads nothing;
- mounting reads nothing;
- `useEffect` reads nothing;
- the button click is the only capture trigger;
- one click calls one command;
- double-click calls one command;
- active command disables the button;
- public state is text-free;
- raw snapshot never enters React state;
- raw snapshot capability is not exposed as a direct getter;
- `START_OVER`/cancel calls `release()`;
- unmount calls `release()`;
- incomplete/invalid errors do not retry automatically;
- no Drive, network, hash, Blob, download, file picker, storage write, or R3;
- production c2a is replaced with synthetic dependency in automated tests.

Manual first-real-click checklist is separate and must be approved in visible
chat. It verifies the correct domain/profile, clean worktree, one click,
exactly three approved keys read, no storage writes, no network, no raw content
in UI/logs, no backup/download, and unchanged localStorage values after capture.

## c2b2 / R2.6.3d Boundary

c2b2 owns only the initial explicit user-gesture capture and local session
lifetime. It does not reread local values after a later Drive step.

R2.6.3d remains separate:

- post-Drive local reread;
- comparison with the original internal snapshot;
- `LOCAL_SNAPSHOT_CHANGED`;
- no merge, repair, normalization, or write.

## Out Of Scope

This review does not implement:

- React/UI runtime;
- App wiring;
- production click handler;
- real localStorage read;
- Writer DB bytes;
- Drive GET;
- hashing;
- assembly;
- manifest;
- Blob/download;
- R2.6.3d;
- R3;
- tombstones;
- purge.

## Smallest Safe Implementation Step

The smallest next implementation should be a synthetic c2b2 UI/controller slice:
add a tiny feature controller or component boundary with injected fake capture,
prove render/mount/effects read nothing, prove one click maps to one c2b1
command, and keep all public output text-free. Do not perform the first real
c2a/localStorage read until a later explicit manual approval gate.
