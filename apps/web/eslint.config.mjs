import { FlatCompat } from "@eslint/eslintrc";

import baseConfig from "../../eslint.config.mjs";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const webConfig = [...baseConfig, ...compat.extends("next/core-web-vitals")];

export default webConfig;
