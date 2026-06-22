import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const nextConfigs = compat.extends("next/core-web-vitals").map((config) => ({
  ...config,
  files: ["apps/web/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
}));

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextConfigs,
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
);
