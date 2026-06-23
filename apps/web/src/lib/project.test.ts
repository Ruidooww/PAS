import { describe, expect, it } from "vitest";

import { projectOverview } from "./project";

describe("projectOverview", () => {
  it("derives the supported roles from the shared package", () => {
    expect(projectOverview.roles).toEqual([
      "admin",
      "presales",
      "aftersales",
      "implementation",
      "external",
    ]);
  });

  it("exposes the E0 mock QA endpoint", () => {
    expect(projectOverview.mockQaEndpoint).toBe("POST /api/internal/qa");
  });
});
