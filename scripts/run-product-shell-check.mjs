import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = mkdtempSync(join(tmpdir(), "lassilab-product-shell-check-"));

const prototypeFiles = [
  "src/ProductShellPrototype.tsx",
  "src/productShellPrototypeModel.ts",
  "src/productShellDataMode.ts"
];

const forbiddenPatterns = [
  "localStorage",
  "loadWriterPackages",
  "loadWriterPackageCatalog",
  "syncGoogleDrive",
  "connectGoogleDrive",
  "importWriterDb",
  "executeWriterDbImport",
  "createWriterDbExport",
  "writerDbImportRuntime"
];

try {
  writeFileSync(join(outputDir, "package.json"), JSON.stringify({ type: "commonjs" }));

  const tscPath = resolve(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const compile = spawnSync(
    process.execPath,
    [
      tscPath,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--strict",
      "--skipLibCheck",
      "--esModuleInterop",
      "--outDir",
      outputDir,
      "src/productShellPrototypeModelChecks.ts",
      "src/productShellDataModeChecks.ts",
      "src/productShellReadOnlyLibraryChecks.ts",
      "src/writerLibraryViewModelChecks.ts",
      "src/writerLibraryDetailViewModelChecks.ts",
      "src/writerLibraryReadOnlySnapshotChecks.ts",
      "src/writerLibraryReadOnlySelectionChecks.ts",
      "src/writerLibraryReadOnlyProviderChecks.ts",
      "src/productShellReadOnlyDetailChecks.ts"
    ],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (compile.status !== 0) {
    process.exit(compile.status ?? 1);
  }

  const run = spawnSync(
    process.execPath,
    [join(outputDir, "productShellPrototypeModelChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }

  const libraryRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerLibraryViewModelChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (libraryRun.status !== 0) {
    process.exit(libraryRun.status ?? 1);
  }

  const detailRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerLibraryDetailViewModelChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (detailRun.status !== 0) {
    process.exit(detailRun.status ?? 1);
  }

  const snapshotRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerLibraryReadOnlySnapshotChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (snapshotRun.status !== 0) {
    process.exit(snapshotRun.status ?? 1);
  }

  const selectionRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerLibraryReadOnlySelectionChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (selectionRun.status !== 0) {
    process.exit(selectionRun.status ?? 1);
  }

  const providerRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerLibraryReadOnlyProviderChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (providerRun.status !== 0) {
    process.exit(providerRun.status ?? 1);
  }

  const dataModeRun = spawnSync(
    process.execPath,
    [join(outputDir, "productShellDataModeChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (dataModeRun.status !== 0) {
    process.exit(dataModeRun.status ?? 1);
  }

  const readOnlyLibraryRun = spawnSync(
    process.execPath,
    [join(outputDir, "productShellReadOnlyLibraryChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (readOnlyLibraryRun.status !== 0) {
    process.exit(readOnlyLibraryRun.status ?? 1);
  }

  const readOnlyDetailRun = spawnSync(
    process.execPath,
    [join(outputDir, "productShellReadOnlyDetailChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (readOnlyDetailRun.status !== 0) {
    process.exit(readOnlyDetailRun.status ?? 1);
  }

  let isolationChecks = 0;
  for (const relativePath of prototypeFiles) {
    const source = readFileSync(resolve(repoRoot, relativePath), "utf8");
    for (const pattern of forbiddenPatterns) {
      if (source.includes(pattern)) {
        throw new Error(`${relativePath} contains forbidden runtime reference: ${pattern}`);
      }
    }
    isolationChecks += 1;
  }

  const productionEntries = ["index.html", "src/main.tsx", "src/App.tsx"]
    .map((relativePath) => readFileSync(resolve(repoRoot, relativePath), "utf8"))
    .join("\n");
  if (productionEntries.includes("product-shell.html") || productionEntries.includes("ProductShellPrototype")) {
    throw new Error("Production entry points must not reference the product shell prototype.");
  }
  isolationChecks += 1;

  console.log(`Product shell isolation checks: ${isolationChecks}/${isolationChecks} passed.`);

  const writerLibrarySource = readFileSync(
    resolve(repoRoot, "src/writerLibraryViewModel.ts"),
    "utf8"
  ).toLowerCase();
  const writerLibraryForbiddenPatterns = [
    "from \"react\"",
    "from 'react'",
    "from \"./storage\"",
    "from './storage'",
    "writerpackagestorage",
    "loadwriterpackagecatalog",
    "localstorage",
    "sessionstorage",
    "window.",
    "document.",
    "globalthis",
    "navigator.",
    "location.",
    "indexeddb",
    "caches.",
    "date.now",
    "new date",
    "performance.",
    "settimeout",
    "setinterval",
    "math.random",
    "crypto.",
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "http://",
    "https://",
    "googledrive"
  ];

  for (const pattern of writerLibraryForbiddenPatterns) {
    if (writerLibrarySource.includes(pattern)) {
      throw new Error(`Writer Library view model contains forbidden dependency: ${pattern}`);
    }
  }

  console.log("Writer library isolation checks: 1/1 passed.");

  const writerLibraryDetailSource = readFileSync(
    resolve(repoRoot, "src/writerLibraryDetailViewModel.ts"),
    "utf8"
  ).toLowerCase();
  const detailRuntimeForbiddenPatterns = [
    "from \"react\"",
    "from 'react'",
    "writerpackagestorage",
    "writerlibraryreadonlyprovider",
    "loadwriterpackagecatalog",
    "getwriterpackagebyid",
    "localstorage",
    "sessionstorage",
    "window.",
    "document.",
    "globalthis",
    "navigator.",
    "location.",
    "indexeddb",
    "caches.",
    "date.now",
    "new date",
    "performance.",
    "settimeout",
    "setinterval",
    "math.random",
    "crypto.",
    "console.",
    "setitem",
    "removeitem",
    "savewriter",
    "upsertwriter",
    "deletewriter"
  ];
  const detailNetworkForbiddenPatterns = [
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "http://",
    "https://",
    "googledrive"
  ];
  let detailIsolationChecks = 0;

  for (const pattern of detailRuntimeForbiddenPatterns) {
    if (writerLibraryDetailSource.includes(pattern)) {
      throw new Error(`Writer Library detail view model contains forbidden runtime dependency: ${pattern}`);
    }
  }
  detailIsolationChecks += 1;

  for (const pattern of detailNetworkForbiddenPatterns) {
    if (writerLibraryDetailSource.includes(pattern)) {
      throw new Error(`Writer Library detail view model contains forbidden network dependency: ${pattern}`);
    }
  }
  detailIsolationChecks += 1;

  for (const pattern of ["detailsbyid", "record<", "new map", "map<"]) {
    if (writerLibraryDetailSource.includes(pattern)) {
      throw new Error(`B5.1 detail view model contains future B5.2 snapshot behavior: ${pattern}`);
    }
  }
  detailIsolationChecks += 1;

  console.log(
    `Writer library detail isolation checks: ${detailIsolationChecks}/${detailIsolationChecks} passed.`
  );

  const writerLibrarySnapshotSource = readFileSync(
    resolve(repoRoot, "src/writerLibraryReadOnlySnapshot.ts"),
    "utf8"
  ).toLowerCase();
  const snapshotRuntimeForbiddenPatterns = [
    "from \"react\"",
    "from 'react'",
    "writerpackagestorage",
    "writerlibraryreadonlyprovider",
    "loadwriterpackagecatalog",
    "getwriterpackagebyid",
    "localstorage",
    "sessionstorage",
    "window.",
    "document.",
    "globalthis",
    "navigator.",
    "location.",
    "indexeddb",
    "caches.",
    "date.now",
    "new date",
    "performance.",
    "settimeout",
    "setinterval",
    "math.random",
    "crypto.",
    "console.",
    "setitem",
    "removeitem",
    "savewriter",
    "upsertwriter",
    "deletewriter"
  ];
  const snapshotNetworkForbiddenPatterns = [
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "http://",
    "https://",
    "googledrive"
  ];
  let snapshotIsolationChecks = 0;

  for (const pattern of snapshotRuntimeForbiddenPatterns) {
    if (writerLibrarySnapshotSource.includes(pattern)) {
      throw new Error(`Writer Library snapshot contains forbidden runtime dependency: ${pattern}`);
    }
  }
  snapshotIsolationChecks += 1;

  for (const pattern of snapshotNetworkForbiddenPatterns) {
    if (writerLibrarySnapshotSource.includes(pattern)) {
      throw new Error(`Writer Library snapshot contains forbidden network dependency: ${pattern}`);
    }
  }
  snapshotIsolationChecks += 1;

  if (
    !writerLibrarySnapshotSource.includes("buildwriterlibraryitems(catalog)") ||
    !writerLibrarySnapshotSource.includes("buildwriterlibrarydetails(catalog)") ||
    !writerLibrarySnapshotSource.includes("object.create(null)") ||
    writerLibrarySnapshotSource.includes("new map") ||
    writerLibrarySnapshotSource.includes("loader")
  ) {
    throw new Error("Writer Library snapshot must remain a pure B1/B5.1 aggregation boundary.");
  }
  snapshotIsolationChecks += 1;

  console.log(
    `Writer library snapshot isolation checks: ${snapshotIsolationChecks}/${snapshotIsolationChecks} passed.`
  );

  const writerLibrarySelectionSource = readFileSync(
    resolve(repoRoot, "src/writerLibraryReadOnlySelection.ts"),
    "utf8"
  ).toLowerCase();
  let selectionIsolationChecks = 0;

  for (const pattern of [
    "from \"react\"",
    "from 'react'",
    "usestate",
    "usereducer",
    "useeffect"
  ]) {
    if (writerLibrarySelectionSource.includes(pattern)) {
      throw new Error(`Writer Library selection contains forbidden React dependency: ${pattern}`);
    }
  }
  selectionIsolationChecks += 1;

  for (const pattern of [
    "localstorage",
    "sessionstorage",
    "window.",
    "document.",
    "globalthis",
    "navigator.",
    "location.",
    "indexeddb",
    "urlsearchparams",
    "date.now",
    "new date",
    "performance.",
    "math.random",
    "crypto."
  ]) {
    if (writerLibrarySelectionSource.includes(pattern)) {
      throw new Error(`Writer Library selection contains forbidden runtime dependency: ${pattern}`);
    }
  }
  selectionIsolationChecks += 1;

  for (const pattern of [
    "writerlibraryreadonlyprovider",
    "loadwriterlibraryreadonly",
    "loadwriterpackagecatalog",
    "getwriterpackagebyid",
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "http://",
    "https://",
    "googledrive",
    "console."
  ]) {
    if (writerLibrarySelectionSource.includes(pattern)) {
      throw new Error(`Writer Library selection contains forbidden data source: ${pattern}`);
    }
  }
  selectionIsolationChecks += 1;

  for (const pattern of [
    "setitem",
    "removeitem",
    "savewriter",
    "upsertwriter",
    "deletewriter",
    "persist",
    "cookie"
  ]) {
    if (writerLibrarySelectionSource.includes(pattern)) {
      throw new Error(`Writer Library selection contains forbidden persistence behavior: ${pattern}`);
    }
  }
  selectionIsolationChecks += 1;

  for (const pattern of [
    "from \"./productshell",
    "from './productshell",
    "classname",
    "onclick",
    "<button",
    "<textarea",
    "<input",
    ".css"
  ]) {
    if (writerLibrarySelectionSource.includes(pattern)) {
      throw new Error(`Writer Library selection contains forbidden UI behavior: ${pattern}`);
    }
  }
  selectionIsolationChecks += 1;

  console.log(
    `Writer library selection isolation checks: ${selectionIsolationChecks}/${selectionIsolationChecks} passed.`
  );

  const writerLibraryProviderSource = readFileSync(
    resolve(repoRoot, "src/writerLibraryReadOnlyProvider.ts"),
    "utf8"
  ).toLowerCase();
  const providerRuntimeForbiddenPatterns = [
    "from \"react\"",
    "from 'react'",
    "writerpackagestorage",
    "loadwriterpackagecatalog",
    "localstorage",
    "sessionstorage",
    "window.",
    "document.",
    "globalthis",
    "navigator.",
    "location.",
    "indexeddb",
    "caches.",
    "date.now",
    "new date",
    "performance.",
    "settimeout",
    "setinterval",
    "math.random",
    "crypto.",
    "console.",
    "setitem",
    "removeitem",
    "savewriter",
    "upsertwriter",
    "deletewriter"
  ];
  const providerNetworkForbiddenPatterns = [
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "http://",
    "https://",
    "googledrive"
  ];
  let providerIsolationChecks = 0;

  for (const pattern of providerRuntimeForbiddenPatterns) {
    if (writerLibraryProviderSource.includes(pattern)) {
      throw new Error(`Writer Library provider contains forbidden runtime dependency: ${pattern}`);
    }
  }
  providerIsolationChecks += 1;

  for (const pattern of providerNetworkForbiddenPatterns) {
    if (writerLibraryProviderSource.includes(pattern)) {
      throw new Error(`Writer Library provider contains forbidden network dependency: ${pattern}`);
    }
  }
  providerIsolationChecks += 1;

  console.log(
    `Writer library provider isolation checks: ${providerIsolationChecks}/${providerIsolationChecks} passed.`
  );

  const dataModeSource = readFileSync(
    resolve(repoRoot, "src/productShellDataMode.ts"),
    "utf8"
  ).toLowerCase();
  const productShellUiSource = ["src/ProductShellPrototype.tsx"]
    .map((relativePath) => readFileSync(resolve(repoRoot, relativePath), "utf8"))
    .join("\n")
    .toLowerCase();
  let dataModeIsolationChecks = 0;

  for (const pattern of ["window", "document", "location", "import.meta", "urlsearchparams"]) {
    if (dataModeSource.includes(pattern)) {
      throw new Error(`Product shell data mode resolver contains browser dependency: ${pattern}`);
    }
  }
  dataModeIsolationChecks += 1;

  for (const pattern of ["localstorage", "sessionstorage", "indexeddb", "cookie", "storage."]) {
    if (dataModeSource.includes(pattern)) {
      throw new Error(`Product shell data mode resolver contains storage dependency: ${pattern}`);
    }
  }
  dataModeIsolationChecks += 1;

  for (const pattern of ["fetch(", "xmlhttprequest", "websocket", "http://", "https://", "googledrive"]) {
    if (dataModeSource.includes(pattern)) {
      throw new Error(`Product shell data mode resolver contains network dependency: ${pattern}`);
    }
  }
  dataModeIsolationChecks += 1;

  for (const pattern of [
    "loadwriterlibraryreadonly",
    "loadwriterpackagecatalog",
    "writerlibraryreadonlyprovider",
    "writerpackagestorage",
    "localstorage"
  ]) {
    if (productShellUiSource.includes(pattern)) {
      throw new Error(`B3 product shell UI contains forbidden data source: ${pattern}`);
    }
  }
  dataModeIsolationChecks += 1;

  const productionDataModeEntries = ["index.html", "src/main.tsx", "src/App.tsx"]
    .map((relativePath) => readFileSync(resolve(repoRoot, relativePath), "utf8"))
    .join("\n")
    .toLowerCase();
  for (const pattern of ["productshelldatamode", "real-read-only"]) {
    if (productionDataModeEntries.includes(pattern)) {
      throw new Error(`Production entry points reference the B3 data mode boundary: ${pattern}`);
    }
  }
  dataModeIsolationChecks += 1;

  console.log(
    `Product shell data mode isolation checks: ${dataModeIsolationChecks}/${dataModeIsolationChecks} passed.`
  );

  const productShellMainSource = readFileSync(
    resolve(repoRoot, "src/productShellMain.tsx"),
    "utf8"
  );
  const readOnlyAssemblySource = readFileSync(
    resolve(repoRoot, "src/productShellReadOnlyLibrary.ts"),
    "utf8"
  );
  const readOnlyUiSource = readFileSync(
    resolve(repoRoot, "src/ProductShellReadOnlyLibraryView.tsx"),
    "utf8"
  );
  const readOnlyChecksSource = readFileSync(
    resolve(repoRoot, "src/productShellReadOnlyLibraryChecks.ts"),
    "utf8"
  );
  const readOnlyDetailUiSource = readFileSync(
    resolve(repoRoot, "src/ProductShellReadOnlyDetailView.tsx"),
    "utf8"
  );
  const readOnlyDetailModelSource = readFileSync(
    resolve(repoRoot, "src/productShellReadOnlyDetail.ts"),
    "utf8"
  );
  const readOnlyDetailChecksSource = readFileSync(
    resolve(repoRoot, "src/productShellReadOnlyDetailChecks.ts"),
    "utf8"
  );
  const readOnlySelectionSource = readFileSync(
    resolve(repoRoot, "src/writerLibraryReadOnlySelection.ts"),
    "utf8"
  );
  const productShellCssSource = readFileSync(
    resolve(repoRoot, "src/productShellPrototype.css"),
    "utf8"
  );
  const compactReadOnlyUiSource = readOnlyUiSource.replace(/\s+/g, " ");
  const readOnlyRuntimeUiSource = [readOnlyUiSource, readOnlyDetailUiSource]
    .join("\n")
    .toLowerCase();
  const b4RuntimeSource = [
    productShellMainSource,
    readOnlyAssemblySource,
    readOnlyUiSource,
    readOnlyDetailUiSource,
    readOnlyDetailModelSource,
    readOnlySelectionSource
  ].join("\n").toLowerCase();
  let readOnlyLibraryIsolationChecks = 0;

  if (
    !productShellMainSource.includes(
      'import { loadWriterPackageCatalog } from "./writerPackageStorage";'
    ) ||
    !productShellMainSource.includes("catalogLoader: loadWriterPackageCatalog") ||
    productShellMainSource.indexOf("const data =") >
      productShellMainSource.indexOf("createRoot(root).render")
  ) {
    throw new Error("B4 assembly must inject the existing catalog loader before React render.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !compactReadOnlyUiSource.includes(
      '<button className="prototype-primary-button" type="button" disabled>'
    ) ||
    !readOnlyUiSource.includes("Nová iskra · Pripravujeme")
  ) {
    throw new Error("Real read-only mode must keep Nová iskra disabled.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !readOnlyUiSource.includes("prototype-read-only-card") ||
    !readOnlyUiSource.includes("onClick={() => onOpen(item.id)}") ||
    !readOnlyUiSource.includes("item.noteCount") ||
    readOnlyUiSource.includes("openPackage") ||
    readOnlyUiSource.includes("FixtureProductShellPrototype")
  ) {
    throw new Error("Real Library cards must open only the read-only selected detail.");
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const pattern of [
    "savewriterpackages",
    "upsertwriterpackage",
    "deletewriter",
    "migrate",
    "importwriterdb",
    "executewriterdbimport",
    "syncgoogledrive",
    "connectgoogledrive",
    "console."
  ]) {
    if (b4RuntimeSource.includes(pattern)) {
      throw new Error(`B4 runtime contains forbidden write or private-data API: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const pattern of ["setitem", "removeitem", "localstorage.set", "sessionstorage", "indexeddb"]) {
    if (b4RuntimeSource.includes(pattern)) {
      throw new Error(`B4 runtime contains forbidden storage write: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  const lowerReadOnlyChecksSource = readOnlyChecksSource.toLowerCase();
  if (
    !readOnlyChecksSource.includes("Umelý") ||
    lowerReadOnlyChecksSource.includes("loadwriterpackagecatalog") ||
    lowerReadOnlyChecksSource.includes("writerpackagestorage") ||
    lowerReadOnlyChecksSource.includes("localstorage")
  ) {
    throw new Error("B4 checks must use only artificial injected data.");
  }
  readOnlyLibraryIsolationChecks += 1;

  const productionReadOnlyEntries = ["index.html", "src/main.tsx", "src/App.tsx"]
    .map((relativePath) => readFileSync(resolve(repoRoot, relativePath), "utf8"))
    .join("\n")
    .toLowerCase();
  for (const pattern of ["productshellreadonlylibrary", "loadwriterpackagecatalog", "real-read-only"]) {
    if (productionReadOnlyEntries.includes(pattern)) {
      throw new Error(`Production entries reference the B4 Library: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const pattern of [
    "getwriterpackagebyid",
    "<textarea",
    "<input",
    "contenteditable",
    "onchange="
  ]) {
    if (readOnlyRuntimeUiSource.includes(pattern)) {
      throw new Error(`Editable or second-loader behavior leaked into B5.4: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const functionName of [
    "createWriterLibraryReadOnlySelectionState",
    "selectWriterLibraryDetail",
    "setWriterLibraryDetailLayer",
    "returnToWriterLibrary",
    "resolveWriterLibraryReadOnlySelection"
  ]) {
    if (!readOnlyUiSource.includes(functionName)) {
      throw new Error(`B5.4 UI must reuse the published selection model: ${functionName}`);
    }
  }
  if (!readOnlyUiSource.includes("result.snapshot")) {
    throw new Error("B5.4 detail resolution must use the already-loaded snapshot.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !readOnlyUiSource.includes("onOpen={openDetail}") ||
    !readOnlyUiSource.includes("setWriterLibraryDetailLayer(current, layer)") ||
    !readOnlyUiSource.includes("onReturnToLibrary={returnToLibrary}")
  ) {
    throw new Error("B5.4 click, layer, and return transitions are not fully wired.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !readOnlyDetailUiSource.includes("WRITER_LIBRARY_DETAIL_LAYER_OPTIONS.map") ||
    !readOnlyDetailUiSource.includes("aria-pressed={activeLayer === layer.id}") ||
    !readOnlyUiSource.includes('resolvedSelection?.status === "missing-detail"') ||
    !readOnlyUiSource.includes("Dielo sa v tomto načítaní nepodarilo otvoriť.")
  ) {
    throw new Error("B5.4 must expose four pressed-state tabs and a safe missing-detail state.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !readOnlyDetailModelSource.includes('case "spark"') ||
    !readOnlyDetailModelSource.includes('return "notes"') ||
    !readOnlyDetailModelSource.includes('case "final"') ||
    !readOnlyDetailModelSource.includes('return "workshop"')
  ) {
    throw new Error("B5.4 must keep the approved active-to-context layer mapping.");
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    !productShellCssSource.includes("grid-template-columns: minmax(17rem, 34fr) minmax(0, 66fr)") ||
    !productShellCssSource.includes("white-space: pre-wrap") ||
    !productShellCssSource.includes("overflow-wrap: anywhere") ||
    !productShellCssSource.includes("@media (max-width: 760px)") ||
    !productShellCssSource.includes(".prototype-context-panel") ||
    !productShellCssSource.includes("display: none")
  ) {
    throw new Error("B5.4 CSS must preserve the approved PC and one-panel mobile layout.");
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const pattern of [
    "loadwriterpackagecatalog",
    "getwriterpackagebyid",
    "writerpackagestorage",
    "localstorage",
    "setitem",
    "removeitem",
    "save",
    "autosave"
  ]) {
    if (readOnlyRuntimeUiSource.includes(pattern)) {
      throw new Error(`B5.4 UI contains a forbidden loader, storage, or write reference: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  for (const pattern of [
    "productshellreadonlydetailview",
    "productshellreadonlydetail",
    "writerlibraryreadonlyselection"
  ]) {
    if (productionReadOnlyEntries.includes(pattern)) {
      throw new Error(`Production entries reference the B5.4 detail path: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  if (
    (productShellMainSource.match(/loadWriterPackageCatalog/g) ?? []).length !== 2 ||
    (productShellMainSource.match(/catalogLoader: loadWriterPackageCatalog/g) ?? []).length !== 1
  ) {
    throw new Error("B5.4 must retain exactly one injected catalog-loader call site.");
  }
  readOnlyLibraryIsolationChecks += 1;

  const lowerReadOnlyDetailChecksSource = readOnlyDetailChecksSource.toLowerCase();
  if (
    !lowerReadOnlyDetailChecksSource.includes("artificial") ||
    lowerReadOnlyDetailChecksSource.includes("loadwriterpackagecatalog") ||
    lowerReadOnlyDetailChecksSource.includes("writerpackagestorage") ||
    lowerReadOnlyDetailChecksSource.includes("localstorage")
  ) {
    throw new Error("B5.4 checks must use only artificial in-memory detail data.");
  }
  readOnlyLibraryIsolationChecks += 1;

  console.log(
    `Product shell read-only Library isolation checks: ${readOnlyLibraryIsolationChecks}/${readOnlyLibraryIsolationChecks} passed.`
  );
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
