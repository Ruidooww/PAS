import { readFileSync } from "node:fs";

const htmlPath = new URL("./pas-apple-proposal-workspace.html", import.meta.url);
const html = readFileSync(htmlPath, "utf8");

const expectedViews = [
  "home",
  "proposal",
  "customers",
  "opportunities",
  "documents",
  "knowledge",
  "qa",
  "analytics",
  "tasks",
  "settings",
];

for (const view of expectedViews) {
  if (!html.includes(`data-view="${view}"`)) throw new Error(`Missing nav button for ${view}`);
  if (!html.includes(`id="view-${view}"`)) throw new Error(`Missing panel for ${view}`);
}

const requiredText = [
  "方案工作室",
  "智能制造平台项目",
  "客户画像",
  "方案正文",
  "AI 助手",
  "RAG 引用",
  "方案编写进度",
];

for (const text of requiredText) {
  if (!html.includes(text)) {
    throw new Error(`Missing required text: ${text}`);
  }
}

const navCount = (html.match(/data-view="/g) ?? []).length;
if (navCount !== expectedViews.length) {
  throw new Error(`Expected ${expectedViews.length} nav buttons, found ${navCount}`);
}

const scriptRequirements = [
  'querySelectorAll("[data-view]")',
  'addEventListener("click"',
  'classList.add("active")',
  'classList.remove("active")',
  'aria-selected',
];

for (const snippet of scriptRequirements) {
  if (!html.includes(snippet)) throw new Error(`Missing menu interaction script snippet: ${snippet}`);
}

console.log(`Prototype smoke test passed: ${expectedViews.length} clickable menu views verified.`);
