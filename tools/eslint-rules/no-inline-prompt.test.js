const { RuleTester } = require("eslint");

const rule = require("./no-inline-prompt");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const longSql = `
SELECT account_id, customer_name, opportunity_stage, expected_revenue
FROM analytics_pipeline_sales_opportunities
WHERE expected_revenue > 100000 AND opportunity_stage IN ('qualified', 'proposal', 'negotiation')
ORDER BY expected_revenue DESC, customer_name ASC
LIMIT 100
`;

const cjkSegment = "这是一个连续超过三十个汉字的内联提示内容用来触发规则检测并要求迁移到文件";
const inlinePrompt = `${cjkSegment}${cjkSegment}
${cjkSegment}${cjkSegment}
${cjkSegment}${cjkSegment}
${cjkSegment}${cjkSegment}`;

ruleTester.run("no-inline-prompt", rule, {
  valid: [
    {
      filename: "apps/api/src/short.ts",
      code: "const message = '短文本';",
    },
    {
      filename: "apps/api/src/sql.ts",
      code: `const query = \`${longSql}\`;`,
    },
    {
      filename: "apps/api/src/prompt.test.ts",
      code: `const prompt = \`${inlinePrompt}\`;`,
    },
  ],
  invalid: [
    {
      filename: "apps/api/src/prompt.ts",
      code: `const prompt = \`${inlinePrompt}\`;`,
      errors: [
        {
          message:
            "Inline prompt detected; move to apps/api/prompts/<name>.txt and load via loadPrompt('<name>').",
        },
      ],
    },
  ],
});
