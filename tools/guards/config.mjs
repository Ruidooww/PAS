import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ALLOWED_PROVIDER_BOUNDARIES = ["apps/api/src/clients", "packages/clients"];
export const PROVIDER_BOUNDARY_SUPPORT_PATHS = [
  "apps/api/src/config",
  "apps/api/src/public/public-clients.module.ts",
];

export const PROVIDER_IMPORT_TOKENS = [
  "ragflow",
  "fastgpt",
  "openai",
  "@openai",
  "@langchain/openai",
  "embedding",
  "vectordb",
  "vector-db",
  "qdrant",
  "milvus",
  "pinecone",
  "weaviate",
  "chroma",
];

export const PROVIDER_RUNTIME_PATTERNS = [
  { token: "RagflowClientImpl", pattern: /\bnew\s+RagflowClientImpl\b/ },
  { token: "FastGPT", pattern: /\bnew\s+FastGPT\b/ },
  { token: "OpenAI", pattern: /\bnew\s+OpenAI\b/ },
  { token: "Embedding", pattern: /\bnew\s+\w*Embedding\w*\b/ },
  { token: "VectorDB", pattern: /\bnew\s+\w*VectorDB\w*\b/ },
  { token: "Qdrant", pattern: /\bnew\s+Qdrant\b/ },
  { token: "Milvus", pattern: /\bnew\s+Milvus\b/ },
  { token: "Pinecone", pattern: /\bnew\s+Pinecone\b/ },
  { token: "Weaviate", pattern: /\bnew\s+Weaviate\b/ },
  { token: "Chroma", pattern: /\bnew\s+Chroma\b/ },
];

export const PROVIDER_ENV_PATTERNS = [
  { token: "RAGFLOW_BASE_URL", pattern: /\bRAGFLOW_BASE_URL\b/ },
  { token: "RAGFLOW_API_KEY", pattern: /\bRAGFLOW_API_KEY\b/ },
  { token: "FASTGPT_", pattern: /\bFASTGPT_[A-Z0-9_]*\b/ },
  { token: "LLM_API_KEY", pattern: /\bLLM_API_KEY\b/ },
];

export const LATER_STAGE_TOKENS = [
  "PluginManager",
  "AgentRuntime",
  "WorkflowEngine",
  "Marketplace",
  "MultiTenant",
  "TenantManager",
  "ToolRegistry",
  "PluginRegistry",
  "Planner",
  "Executor",
  "PluginMarketplace",
  "MultiAgent",
  "KnowledgeGraph",
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function normalizeRelativePath(rootDir, filePath) {
  return toPosixPath(path.relative(rootDir, filePath));
}

export function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

export function isTestFile(filePath) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(toPosixPath(filePath));
}

export function isUnderAny(relativePath, prefixes) {
  const normalized = toPosixPath(relativePath);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function isAllowedProviderBoundary(relativePath) {
  return isUnderAny(relativePath, ALLOWED_PROVIDER_BOUNDARIES);
}

export function isAllowedProviderSupportPath(relativePath) {
  const normalized = toPosixPath(relativePath);
  return (
    isAllowedProviderBoundary(normalized) ||
    isUnderAny(normalized, PROVIDER_BOUNDARY_SUPPORT_PATHS) ||
    normalized.includes("/adapters/") ||
    normalized.includes("/plugins/") ||
    isTestFile(normalized) ||
    normalized.includes("/__mocks__/") ||
    normalized.includes("/fixtures/")
  );
}

export function findImportSpecifiers(source) {
  const specifiers = [];
  const importPattern =
    /(?:^\s*import\s+(?:[^'"]+\s+from\s+)?|import\s*\(\s*)["']([^"']+)["']/gm;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

export function tokenFromProviderImport(specifier) {
  const normalized = specifier.toLowerCase();
  return PROVIDER_IMPORT_TOKENS.find(
    (token) => normalized === token || normalized.startsWith(`${token}/`) || normalized.includes(token),
  );
}

export function isAllowedProviderImport(rootDir, filePath, specifier) {
  if (specifier === "@pas/clients" || specifier.startsWith("@pas/clients/")) return true;
  if (!specifier.startsWith(".")) return false;

  const resolvedPath = normalizeRelativePath(rootDir, path.resolve(path.dirname(filePath), specifier));
  return isAllowedProviderBoundary(resolvedPath);
}

export async function collectFiles(rootDir, roots, predicate = isSourceFile) {
  const files = [];
  for (const root of roots) {
    const absoluteRoot = path.join(rootDir, root);
    await collectFilesFromDirectory(absoluteRoot, files, predicate);
  }
  return files;
}

async function collectFilesFromDirectory(directory, files, predicate) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFilesFromDirectory(absolutePath, files, predicate);
    } else if (entry.isFile() && predicate(absolutePath)) {
      files.push(absolutePath);
    }
  }
}

export async function readSourceFile(filePath) {
  return await readFile(filePath, "utf8");
}

export function createViolation(guard, file, token, reason, suggestedBoundary) {
  return {
    guard,
    file,
    token,
    reason,
    suggestedBoundary,
  };
}

export function createResult(guard, violations, warnings = []) {
  return {
    guard,
    passed: violations.length === 0,
    violations,
    warnings,
  };
}

export function formatViolation(violation) {
  return [
    `[${violation.guard}] ${violation.file}`,
    violation.reason,
    `Offending token: ${violation.token}`,
    violation.suggestedBoundary,
  ].join("\n");
}

export function printGuardResult(result) {
  for (const warning of result.warnings) {
    console.warn(`[${result.guard}] warning: ${warning}`);
  }

  if (result.passed) {
    console.log("PAS guard passed.");
    return;
  }

  for (const violation of result.violations) {
    console.error(formatViolation(violation));
  }
}

export function isCliEntry(importMetaUrl) {
  return path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(importMetaUrl));
}
