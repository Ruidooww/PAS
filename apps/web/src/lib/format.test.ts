import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats RMB amounts consistently for opportunity surfaces", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(8_000)).toBe("¥ 8,000");
    expect(formatMoney(800_000)).toBe("¥ 80 万");
  });
});
