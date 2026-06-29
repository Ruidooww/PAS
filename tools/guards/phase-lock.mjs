import {
  collectFiles,
  createResult,
  createViolation,
  isCliEntry,
  isTestFile,
  LATER_STAGE_TOKENS,
  normalizeRelativePath,
  printGuardResult,
  readSourceFile,
} from "./config.mjs";

const GUARD_NAME = "phase-lock";
const RUNTIME_ROOTS = ["apps", "packages", "prisma"];
const SOURCE_OR_SCHEMA_EXTENSIONS = /\.(?:[cm]?[jt]sx?|prisma)$/;

export async function runPhaseLock({ rootDir = process.cwd() } = {}) {
  const files = await collectFiles(rootDir, RUNTIME_ROOTS, (filePath) => {
    if (!SOURCE_OR_SCHEMA_EXTENSIONS.test(filePath)) return false;
    return !isTestFile(filePath);
  });
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(rootDir, filePath);
    const source = await readSourceFile(filePath);

    for (const token of LATER_STAGE_TOKENS) {
      const pattern = new RegExp(`\\b${token}\\b`);
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Later-stage ${token} runtime implementation reference detected during V1.5 / V2-prep.`,
          "Keep Agent / Workflow / Marketplace / multi-tenant implementation out of runtime paths until the relevant later phase.",
        ),
      );
    }
  }

  return createResult(GUARD_NAME, violations);
}

if (isCliEntry(import.meta.url)) {
  const result = await runPhaseLock();
  printGuardResult(result);
  if (!result.passed) process.exitCode = 1;
}
