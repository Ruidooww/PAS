import {
  ALLOWED_PROVIDER_BOUNDARIES,
  collectFiles,
  createResult,
  createViolation,
  findImportSpecifiers,
  isAllowedProviderImport,
  isAllowedProviderSupportPath,
  isCliEntry,
  normalizeRelativePath,
  printGuardResult,
  PROVIDER_ENV_PATTERNS,
  PROVIDER_RUNTIME_PATTERNS,
  readSourceFile,
  tokenFromProviderImport,
} from "./config.mjs";

const GUARD_NAME = "provider-boundary";
const SCAN_ROOTS = ["apps/api/src", "apps/web/src", "packages"];
const SUGGESTED_BOUNDARY = `Use client interface / provider adapter boundary instead.\nAllowed boundaries: ${ALLOWED_PROVIDER_BOUNDARIES.join(", ")}`;

export async function runProviderBoundary({ rootDir = process.cwd() } = {}) {
  const files = await collectFiles(rootDir, SCAN_ROOTS);
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(rootDir, filePath);
    const source = await readSourceFile(filePath);

    if (isAllowedProviderSupportPath(relativePath)) continue;

    for (const specifier of findImportSpecifiers(source)) {
      const token = tokenFromProviderImport(specifier);
      if (!token) continue;
      if (isAllowedProviderImport(rootDir, filePath, specifier)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider import detected outside the provider boundary.`,
          SUGGESTED_BOUNDARY,
        ),
      );
    }

    for (const { token, pattern } of PROVIDER_RUNTIME_PATTERNS) {
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider construction detected in runtime code.`,
          SUGGESTED_BOUNDARY,
        ),
      );
    }

    for (const { token, pattern } of PROVIDER_ENV_PATTERNS) {
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider configuration access detected outside the provider boundary.`,
          SUGGESTED_BOUNDARY,
        ),
      );
    }
  }

  return createResult(GUARD_NAME, violations);
}

if (isCliEntry(import.meta.url)) {
  const result = await runProviderBoundary();
  printGuardResult(result);
  if (!result.passed) process.exitCode = 1;
}
