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
  "src/productShellMain.tsx"
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
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
