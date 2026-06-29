import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runPhaseLock } from "./phase-lock.mjs";
import { runProviderBoundary } from "./provider-boundary.mjs";
import { runServiceBoundary } from "./service-boundary.mjs";

async function withFixture(files, run) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "pas-guards-"));
  try {
    await Promise.all(
      Object.entries(files).map(async ([filePath, content]) => {
        const absolutePath = path.join(rootDir, filePath);
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, content, "utf8");
      }),
    );

    return await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("provider boundary allows client boundary imports but blocks concrete provider imports elsewhere", async () => {
  await withFixture(
    {
      "apps/api/src/clients/ragflow.ts": "export const RAGFLOW_CLIENT = Symbol('RAGFLOW_CLIENT');\n",
      "packages/clients/openai.ts": "import OpenAI from 'openai';\nexport const client = OpenAI;\n",
      "apps/api/src/proposal/proposal.service.ts":
        "import { RAGFLOW_CLIENT } from '../clients/ragflow';\nexport const token = RAGFLOW_CLIENT;\n",
      "apps/api/src/proposal/direct-provider.ts": "import OpenAI from 'openai';\nexport const provider = OpenAI;\n",
    },
    async (rootDir) => {
      const result = await runProviderBoundary({ rootDir });

      assert.equal(result.passed, false);
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].file, "apps/api/src/proposal/direct-provider.ts");
      assert.equal(result.violations[0].token, "openai");
    },
  );
});

test("provider boundary allows config schema and explicit DI wiring exceptions", async () => {
  await withFixture(
    {
      "apps/api/src/config/env.schema.ts":
        "export const env = ['RAGFLOW_BASE_URL', 'RAGFLOW_API_KEY', 'LLM_API_KEY'];\n",
      "apps/api/src/clients/ragflow.ts": "export class RagflowClientImpl {}\nexport class RagflowClientMock {}\n",
      "apps/api/src/public/public-clients.module.ts":
        "import { RagflowClientImpl, RagflowClientMock } from '../clients/ragflow';\nexport const client = new RagflowClientImpl() || new RagflowClientMock();\n",
    },
    async (rootDir) => {
      const result = await runProviderBoundary({ rootDir });

      assert.equal(result.passed, true);
      assert.deepEqual(result.violations, []);
    },
  );
});

test("service boundary blocks direct provider construction and env coupling but allows injected clients", async () => {
  await withFixture(
    {
      "apps/api/src/clients/ragflow.ts": "export const RAGFLOW_CLIENT = Symbol('RAGFLOW_CLIENT');\n",
      "apps/api/src/qa/qa.service.ts":
        "import { RAGFLOW_CLIENT } from '../clients/ragflow';\nexport class QaService { constructor(client = RAGFLOW_CLIENT) {} }\n",
      "apps/api/src/bad/bad.service.ts":
        "import OpenAI from 'openai';\nexport class BadService { run() { return new OpenAI({ apiKey: process.env.LLM_API_KEY }); } }\n",
    },
    async (rootDir) => {
      const result = await runServiceBoundary({ rootDir });

      assert.equal(result.passed, false);
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].file, "apps/api/src/bad/bad.service.ts");
      assert.match(result.violations[0].reason, /provider/i);
    },
  );
});

test("phase lock ignores governance docs while blocking later-stage runtime implementation", async () => {
  await withFixture(
    {
      "docs/execution/current-phase.md": "Current phase: V1.5 / V2-prep. AgentRuntime is deferred.\n",
      ".github/pull_request_template.md": "No premature AgentRuntime implementation.\n",
      "tools/guards/README.md": "The guard flags AgentRuntime in runtime paths.\n",
      "apps/api/src/agent/runtime.ts": "export class AgentRuntime {}\n",
    },
    async (rootDir) => {
      const result = await runPhaseLock({ rootDir });

      assert.equal(result.passed, false);
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].file, "apps/api/src/agent/runtime.ts");
      assert.equal(result.violations[0].token, "AgentRuntime");
    },
  );
});
