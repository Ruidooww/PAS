import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

function runNode(args: string[]): string {
  return execFileSync(process.execPath, args, {
    cwd: packageRoot,
    encoding: "utf8",
  }).trim();
}

describe("@pas/clients package exports", () => {
  it("loads the root and mock subpath through CommonJS require", () => {
    const output = runNode([
      "-e",
      [
        'const root = require("@pas/clients");',
        'const mock = require("@pas/clients/idp/mock");',
        "console.log(JSON.stringify({",
        '  root: typeof root.MockIdpClient === "function",',
        '  subpath: typeof mock.MockIdpClient === "function",',
        "}));",
      ].join("\n"),
    ]);

    expect(JSON.parse(output)).toEqual({ root: true, subpath: true });
  });

  it("keeps the root export loadable through ESM import", () => {
    const output = runNode([
      "--input-type=module",
      "-e",
      [
        'const root = await import("@pas/clients");',
        'console.log(typeof root.MockIdpClient === "function");',
      ].join("\n"),
    ]);

    expect(output).toBe("true");
  });
});
