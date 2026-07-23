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
      "src/writerLibraryReadOnlyProviderChecks.ts"
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
  const compactReadOnlyUiSource = readOnlyUiSource.replace(/\s+/g, " ");
  const b4RuntimeSource = [
    productShellMainSource,
    readOnlyAssemblySource,
    readOnlyUiSource
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
    !readOnlyUiSource.includes("disabled") ||
    !readOnlyUiSource.includes("item.noteCount") ||
    readOnlyUiSource.includes("openPackage") ||
    readOnlyUiSource.includes("FixtureProductShellPrototype") ||
    readOnlyUiSource.includes("onClick")
  ) {
    throw new Error("Real Library cards must not open fixture or editable detail.");
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

  for (const pattern of ["getWriterPackageById", "<textarea", "<input", "onChange="]) {
    if (readOnlyUiSource.includes(pattern)) {
      throw new Error(`B5 detail or editing leaked into B4: ${pattern}`);
    }
  }
  readOnlyLibraryIsolationChecks += 1;

  console.log(
    `Product shell read-only Library isolation checks: ${readOnlyLibraryIsolationChecks}/${readOnlyLibraryIsolationChecks} passed.`
  );
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
