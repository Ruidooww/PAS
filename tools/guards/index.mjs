import { formatViolation } from "./config.mjs";
import { runPhaseLock } from "./phase-lock.mjs";
import { runProviderBoundary } from "./provider-boundary.mjs";
import { runServiceBoundary } from "./service-boundary.mjs";

const results = await Promise.all([
  runProviderBoundary(),
  runServiceBoundary(),
  runPhaseLock(),
]);

const warnings = results.flatMap((result) =>
  result.warnings.map((warning) => `[${result.guard}] warning: ${warning}`),
);
const violations = results.flatMap((result) => result.violations);

for (const warning of warnings) {
  console.warn(warning);
}

if (violations.length === 0) {
  console.log("PAS guard passed.");
} else {
  for (const violation of violations) {
    console.error(formatViolation(violation));
  }
  process.exitCode = 1;
}
