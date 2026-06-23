import { describe, expect, it } from "vitest";

import { ACL_SCOPES, PROPOSAL_STATUSES, USER_ROLES } from "./index";

describe("shared domain constants", () => {
  it("exports the E0 user roles", () => {
    expect(USER_ROLES).toEqual(["admin", "presales", "aftersales", "implementation", "external"]);
  });

  it("exports proposal lifecycle states", () => {
    expect(PROPOSAL_STATUSES).toContain("draft");
    expect(PROPOSAL_STATUSES).toContain("final");
  });

  it("reserves document-level ACL scopes", () => {
    expect(ACL_SCOPES).toEqual(["public", "internal"]);
  });
});
