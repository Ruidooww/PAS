import eslint from "@eslint/js";
import { createRequire } from "node:module";
import globals from "globals";
import tseslint from "typescript-eslint";

const require = createRequire(import.meta.url);
const noInlinePrompt = require("./tools/eslint-rules/no-inline-prompt.js");

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    plugins: {
      local: {
        rules: {
          "no-inline-prompt": noInlinePrompt,
        },
      },
    },
    rules: {
      "local/no-inline-prompt": "error",
    },
  },
);
