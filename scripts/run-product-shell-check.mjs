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
      "src/productShellPrototypeModelChecks.ts"
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
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
