"use strict";

const MESSAGE =
  "Inline prompt detected; move to apps/api/prompts/<name>.txt and load via loadPrompt('<name>').";

function shouldSkipFile(filename) {
  return /(?:^|[\\/])[^\\/]+\.(?:test|spec)\.ts$/.test(filename);
}

function shouldReport(value) {
  return (
    value.length > 200 &&
    (value.match(/\n/g) ?? []).length >= 3 &&
    /[\u4e00-\u9fa5]{30,}/.test(value)
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow large inline Chinese prompts in API source",
    },
    schema: [],
    messages: {
      inlinePrompt: MESSAGE,
    },
  },
  create(context) {
    if (shouldSkipFile(context.filename ?? context.getFilename())) {
      return {};
    }

    function check(node, value) {
      if (shouldReport(value)) {
        context.report({ node, messageId: "inlinePrompt" });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateLiteral(node) {
        const value = node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
        check(node, value);
      },
    };
  },
};
