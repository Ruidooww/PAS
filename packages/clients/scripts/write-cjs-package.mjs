import { mkdir, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../dist/cjs/", import.meta.url);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL("package.json", outputDirectory),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  "utf8",
);
