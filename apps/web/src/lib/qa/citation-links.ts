const DEFAULT_SOURCE_PREFIX = "qa-source";

export function linkAnswerCitations(
  markdown: string,
  referenceNumbers: number[],
  sourcePrefix = DEFAULT_SOURCE_PREFIX,
): string {
  const knownReferences = new Set(referenceNumbers);
  let result = "";
  let index = 0;
  let inFence = false;
  let inInlineCode = false;
  let linkDestinationDepth = 0;

  while (index < markdown.length) {
    if (!inInlineCode && markdown.startsWith("```", index)) {
      inFence = !inFence;
      result += "```";
      index += 3;
      continue;
    }

    const character = markdown[index]!;
    if (!inFence && character === "`") {
      inInlineCode = !inInlineCode;
      result += character;
      index += 1;
      continue;
    }

    if (!inFence && !inInlineCode) {
      if (markdown.startsWith("](", index)) {
        linkDestinationDepth = 1;
        result += "](";
        index += 2;
        continue;
      }
      if (linkDestinationDepth > 0) {
        if (character === "(") linkDestinationDepth += 1;
        if (character === ")") linkDestinationDepth -= 1;
        result += character;
        index += 1;
        continue;
      }

      const citation = markdown.slice(index).match(/^\[(\d+)\]/);
      if (citation) {
        const number = Number(citation[1]);
        const previous = markdown[index - 1];
        const next = markdown[index + citation[0].length];
        if (
          knownReferences.has(number) &&
          previous !== "!" &&
          previous !== "\\" &&
          next !== "("
        ) {
          result += `[${number}](#${sourcePrefix}-${number})`;
          index += citation[0].length;
          continue;
        }
      }
    }

    result += character;
    index += 1;
  }

  return result;
}
