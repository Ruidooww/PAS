import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(process.cwd(), "src");

describe("design tokens", () => {
  it("defines the enterprise blue palette centrally", () => {
    const tokens = readFileSync(join(srcDir, "styles", "tokens.css"), "utf8");

    expect(tokens).toContain("--blue: #1E3A8A");
    expect(tokens).toContain("--blue-strong: #2B4DA8");
    expect(tokens).toContain("--blue-soft: #E8EEF8");
    expect(tokens).toContain('html[data-theme="dark"]');
  });

  it("removes the old Apple blue tokens from workspace styles", () => {
    const files = [
      "components/shell/app-shell.module.css",
      "components/workspace/proposal-workspace.module.css",
      "components/workspace/dashboard-view.module.css",
      "components/workspace/workshop-view.module.css",
    ];

    const combined = files
      .map((file) => readFileSync(join(srcDir, file), "utf8"))
      .join("\n");

    expect(combined).not.toMatch(/#0a84ff/i);
    expect(combined).not.toMatch(/#e6f1fb/i);
  });
});
