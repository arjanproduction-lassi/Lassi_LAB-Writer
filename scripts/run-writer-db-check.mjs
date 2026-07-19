import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = mkdtempSync(join(tmpdir(), "lassilab-writer-db-check-"));

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
      "--lib",
      "es2020,dom",
      "--strict",
      "--skipLibCheck",
      "--esModuleInterop",
      "--outDir",
      outputDir,
      "src/writerDbChecks.ts",
      "src/writerDbPersistenceChecks.ts",
      "src/writerDbRecoveryChecks.ts",
      "src/writerDbImportPreviewChecks.ts",
      "src/writerDbImportPreflightChecks.ts",
      "src/writerDbImportPreviewUiChecks.ts",
      "src/writerDbImportExecutionChecks.ts"
    ],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (compile.status !== 0) {
    process.exit(compile.status ?? 1);
  }

  const run = spawnSync(process.execPath, [join(outputDir, "writerDbChecks.js")], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }

  const persistenceRun = spawnSync(process.execPath, [join(outputDir, "writerDbPersistenceChecks.js")], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (persistenceRun.status !== 0) {
    process.exit(persistenceRun.status ?? 1);
  }

  const recoveryRun = spawnSync(process.execPath, [join(outputDir, "writerDbRecoveryChecks.js")], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (recoveryRun.status !== 0) {
    process.exit(recoveryRun.status ?? 1);
  }

  const previewPreparationRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerDbImportPreviewChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (previewPreparationRun.status !== 0) {
    process.exit(previewPreparationRun.status ?? 1);
  }

  const preflightRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerDbImportPreflightChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (preflightRun.status !== 0) {
    process.exit(preflightRun.status ?? 1);
  }

  const previewUiRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerDbImportPreviewUiChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (previewUiRun.status !== 0) {
    process.exit(previewUiRun.status ?? 1);
  }

  const executionRun = spawnSync(
    process.execPath,
    [join(outputDir, "writerDbImportExecutionChecks.js")],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (executionRun.status !== 0) {
    process.exit(executionRun.status ?? 1);
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
