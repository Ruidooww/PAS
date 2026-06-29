import {
  ALLOWED_PROVIDER_BOUNDARIES,
  collectFiles,
  createResult,
  createViolation,
  findImportSpecifiers,
  isAllowedProviderImport,
  isCliEntry,
  normalizeRelativePath,
  printGuardResult,
  PROVIDER_ENV_PATTERNS,
  PROVIDER_RUNTIME_PATTERNS,
  readSourceFile,
  tokenFromProviderImport,
} from "./config.mjs";

const GUARD_NAME = "service-boundary";
const SERVICE_ROOTS = ["apps/api/src"];
const SERVICE_FILE_PATTERN = /\.service\.tsx?$/;
const LATER_STAGE_SERVICE_PATTERNS = [
  { token: "AgentRuntime", pattern: /\bAgentRuntime\b/ },
  { token: "Planner", pattern: /\bPlanner\b/ },
  { token: "Executor", pattern: /\bExecutor\b/ },
];
const SUGGESTED_BOUNDARY = `Use injected client interfaces or application-level ports.\nAllowed boundaries: ${ALLOWED_PROVIDER_BOUNDARIES.join(", ")}`;

export async function runServiceBoundary({ rootDir = process.cwd() } = {}) {
  const files = await collectFiles(rootDir, SERVICE_ROOTS, (filePath) =>
    SERVICE_FILE_PATTERN.test(filePath),
  );
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizeRelativePath(rootDir, filePath);
    const source = await readSourceFile(filePath);

    for (const specifier of findImportSpecifiers(source)) {
      const token = tokenFromProviderImport(specifier);
      if (!token) continue;
      if (isAllowedProviderImport(rootDir, filePath, specifier)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider import detected in a service file.`,
          SUGGESTED_BOUNDARY,
        ),
      );
    }

    if (violations.some((violation) => violation.file === relativePath)) continue;

    for (const { token, pattern } of PROVIDER_RUNTIME_PATTERNS) {
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider construction detected in a service file.`,
          SUGGESTED_BOUNDARY,
        ),
      );
      break;
    }

    if (violations.some((violation) => violation.file === relativePath)) continue;

    for (const { token, pattern } of PROVIDER_ENV_PATTERNS) {
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Direct ${token} provider configuration access detected in a service file.`,
          SUGGESTED_BOUNDARY,
        ),
      );
      break;
    }

    if (violations.some((violation) => violation.file === relativePath)) continue;

    if (/\bfetch\s*\(/.test(source) && /\b(?:RAGFLOW|FASTGPT|OPENAI|LLM_API_KEY)\b/i.test(source)) {
      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          "fetch",
          "Direct provider HTTP access detected in a service file.",
          SUGGESTED_BOUNDARY,
        ),
      );
    }

    if (violations.some((violation) => violation.file === relativePath)) continue;

    for (const { token, pattern } of LATER_STAGE_SERVICE_PATTERNS) {
      if (!pattern.test(source)) continue;

      violations.push(
        createViolation(
          GUARD_NAME,
          relativePath,
          token,
          `Later-stage ${token} reference detected in a service file.`,
          "Keep V3/V4 runtime concepts out of V1.5 / V2-prep service orchestration.",
        ),
      );
      break;
    }
  }

  return createResult(GUARD_NAME, violations);
}

if (isCliEntry(import.meta.url)) {
  const result = await runServiceBoundary();
  printGuardResult(result);
  if (!result.passed) process.exitCode = 1;
}
