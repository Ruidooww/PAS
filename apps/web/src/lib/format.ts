export function formatMoney(value: number | null): string {
  if (value == null) return "-";
  if (value >= 10_000) return `¥ ${(value / 10_000).toLocaleString("zh-CN")} 万`;
  return `¥ ${value.toLocaleString("zh-CN")}`;
}
