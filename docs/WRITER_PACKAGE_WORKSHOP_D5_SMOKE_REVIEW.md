# WriterPackage Workshop D5 Smoke Review

## Scope

D5 smoke was run after the published D4d product-shell development UI commit
`ac7e5c11894c812b725a056272f759468c9933f9`.

This review covers only the development-only product shell route:

`product-shell.html?mode=real-edit-workshop`

It used isolated browser profiles and synthetic disposable WriterPackages and
Sparks. It did not use existing author Packages, production deployment data, or
real author text.

## Result

D5 smoke passed for the supported development route.

The smoke verified:

- adapted legacy Sparks remain read-only and expose no textarea or input;
- **Nová iskra** remains disabled;
- an existing fresh WriterPackage opens exactly one editable `workshopText`
  textarea;
- title, Spark, notes, final text, tombstoned Packages, and Spark storage are
  not edited by the workshop save path;
- autosave writes the changed `workshopText` to the existing Package storage
  key and reload preserves the saved text;
- no new localStorage key is created during the tested save path;
- ordinary navigation with an unsaved draft shows the dirty-exit confirmation;
- a second tab cannot acquire the editor while the first tab holds the Web Lock
  and stays read-only with the lock-denied copy;
- a newer external Package revision produces `Konflikt` and does not overwrite
  that newer stored value;
- a simulated Package storage write failure shows
  `Uloženie zlyhalo bezpečne`, keeps the draft visible, and leaves stored data
  unchanged;
- double-clicking **Uložiť teraz** performs one Package-key write;
- offline local save still writes locally and the UI continues to state that
  Google sync is Sparks-only;
- desktop, mobile, and practical reflow widths used in the smoke had no
  horizontal overflow.

## Observations

Browser automation used disposable Playwright sessions and temporary synthetic
localStorage seeds. Temporary Playwright artifacts and helper scripts were
removed after the smoke, and the working tree returned to clean.

The local Vite dev server hit the known sandbox `spawn EPERM` behavior and was
started outside the sandbox on `127.0.0.1` for the duration of the smoke. It was
stopped after the run.

CSS `zoom: 2` is not treated as authoritative evidence for browser zoom because
it artificially scales the layout box. Practical reflow was checked through
smaller CSS viewport widths, including 640, 390, and 320 pixels. A 240 pixel
viewport exposed the existing 320 pixel minimum layout floor and is not treated
as a D5 blocker.

The browser console showed only normal React development guidance and a missing
favicon request during these smoke runs. No production runtime errors were
observed in the tested route.

## Boundaries

D5 smoke does not authorize:

- production `App.tsx` wiring;
- product-shell cutover as the normal Writer route;
- Package creation, title editing, Spark editing, notes editing, final text
  editing, deletion, restore, or merge;
- a new draft, lock, backup, transaction, or preference storage key;
- crash recovery for dirty in-memory text;
- Google Drive v2, Package sync, OAuth, network, or backend changes;
- Writer DB import/export/recovery changes;
- legacy Spark retirement, reset, purge, or R3;
- deployment.

## Remaining Gate

Before any production editing decision, do one short human spot-check in a
disposable browser profile using disposable local data. The spot-check should
confirm the visible focus behavior, labels, and resize/zoom feel in the actual
browser UI. Keep D6 crash recovery and D7 sync readiness as separate decisions.
