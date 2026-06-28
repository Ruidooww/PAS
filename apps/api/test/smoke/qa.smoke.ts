import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "../..");
const composeFile = path.join(repoRoot, "infra", "docker-compose.ci.yml");
const diagnosticsDir = path.join(process.cwd(), "test-results", "smoke");
const projectName = "pas-ci-smoke";
const apiBaseUrl = "http://127.0.0.1:13001";
const hostDatabaseUrl = "postgresql://pas:pas@127.0.0.1:15444/pas";

const dockerBin =
  process.env.DOCKER_BIN ??
  (process.platform === "win32" &&
  existsSync("C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe")
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker");

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface SmokeEvent {
  type?: string;
  content?: string;
  refs?: Array<{ n?: number; docName?: string }>;
}

const composeBaseArgs = ["compose", "-f", composeFile, "-p", projectName];

async function run(
  command: string,
  args: string[],
  options: { allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32" && !command.endsWith(".exe"),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { stdout, stderr };
      if (code === 0 || options.allowFailure) {
        resolve(result);
        return;
      }
      reject(
        new Error(
          [
            `Command failed (${code}): ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

async function compose(args: string[], options?: { allowFailure?: boolean }): Promise<CommandResult> {
  return run(dockerBin, [...composeBaseArgs, ...args], options);
}

async function waitForHealthy(service: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ps = await compose(["ps", "-q", service], { allowFailure: true });
    const containerId = ps.stdout.trim();
    if (containerId) {
      const inspect = await run(
        dockerBin,
        ["inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", containerId],
        { allowFailure: true },
      );
      if (inspect.stdout.trim() === "healthy") return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${service} did not become healthy within ${timeoutMs}ms`);
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

function setCookies(headers: Headers): string[] {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const values = withSetCookie.getSetCookie?.();
  if (values?.length) return values;
  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=\s*[^;,]+=)/).map((value) => value.trim()) : [];
}

function mergeCookies(cookieJar: Map<string, string>, headers: Headers): void {
  for (const header of setCookies(headers)) {
    const [pair] = header.split(";");
    const separator = pair?.indexOf("=") ?? -1;
    if (!pair || separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  }
}

function cookieHeader(cookieJar: Map<string, string>): string {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function loginWithMockIdp(): Promise<Map<string, string>> {
  const cookieJar = new Map<string, string>();
  const login = await fetch(`${apiBaseUrl}/auth/login?provider=mock`, { redirect: "manual" });
  expect(login.status).toBe(302);
  mergeCookies(cookieJar, login.headers);
  const location = login.headers.get("location");
  if (!location) throw new Error("Mock login did not return a callback location");

  const callback = await fetch(location, {
    headers: { cookie: cookieHeader(cookieJar) },
    redirect: "manual",
  });
  expect(callback.status).toBe(302);
  mergeCookies(cookieJar, callback.headers);

  const me = await fetch(`${apiBaseUrl}/api/me`, {
    headers: { cookie: cookieHeader(cookieJar) },
  });
  expect(me.status).toBe(200);
  const user = (await me.json()) as { uid?: unknown };
  expect(user.uid).toEqual(expect.any(String));
  return cookieJar;
}

function parseSse(text: string): SmokeEvent[] {
  return text
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter(Boolean)
    .map((frame) => {
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);
      if (!data) throw new Error(`Missing data frame in ${frame}`);
      return JSON.parse(data) as SmokeEvent;
    });
}

async function writeComposeDiagnostics(): Promise<void> {
  mkdirSync(diagnosticsDir, { recursive: true });
  const logs = await compose(["logs", "--no-color"], { allowFailure: true });
  writeFileSync(path.join(diagnosticsDir, "compose.log"), logs.stdout + logs.stderr);
}

async function down(): Promise<void> {
  await compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
}

describe("CI integration smoke", () => {
  afterAll(async () => {
    await down();
  });

  it("boots API dependencies, migrates, logs in through mock IdP, and streams QA SSE", async () => {
    try {
      await down();
      await compose(["up", "-d", "--build", "postgres", "redis", "mock-ragflow"]);
      await Promise.all([
        waitForHealthy("postgres"),
        waitForHealthy("redis"),
        waitForHealthy("mock-ragflow"),
      ]);
      await compose([
        "exec",
        "-T",
        "mock-ragflow",
        "node",
        "-e",
        "fetch('http://localhost:9380/datasets').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
      ]);

      await run("pnpm", ["--filter", "api", "exec", "prisma", "migrate", "deploy"], {
        env: { DATABASE_URL: hostDatabaseUrl },
      });
      await run("node", ["apps/api/prisma/seed.js"], {
        env: { DATABASE_URL: hostDatabaseUrl },
      });

      const apiUpArgs = ["up", "-d"];
      apiUpArgs.push(process.env.PAS_SMOKE_API_NO_BUILD === "1" ? "--no-build" : "--build");
      apiUpArgs.push("pas-api");
      await compose(apiUpArgs);
      await waitForHealthy("pas-api", 90_000);
      await waitForHttp(`${apiBaseUrl}/api/health`, 90_000);

      const cookieJar = await loginWithMockIdp();
      const response = await fetch(`${apiBaseUrl}/api/internal/qa`, {
        body: JSON.stringify({
          query: "How should IP-Guard document encryption be configured?",
          sessionId: "ci-smoke-qa",
        }),
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
          cookie: cookieHeader(cookieJar),
        },
        method: "POST",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const events = parseSse(await response.text());
      expect(events).toContainEqual(
        expect.objectContaining({ type: "delta", content: expect.stringContaining("Mock LLM answer") }),
      );
      const refs = events.find((event) => event.type === "refs");
      expect(refs?.refs?.some((ref) => typeof ref.n === "number" && ref.n >= 1)).toBe(true);
      expect(events).toContainEqual({ type: "done" });
    } catch (error) {
      await writeComposeDiagnostics();
      throw error;
    }
  });
});
