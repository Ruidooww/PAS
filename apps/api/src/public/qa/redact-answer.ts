const PROTECTED_MARKDOWN =
  /```[\s\S]*?(?:```|$)|`[^`\r\n]*`|\[[^\]\r\n]*\]\([^\r\n)]*\)|\[ID:\d+\]|\[\d+\]/gi;
const PHONE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const EMAIL =
  /(?<![a-z0-9._%+-])([a-z0-9][a-z0-9._%+-]*)@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?![a-z0-9._%+-])/gi;

export function redactExternalAnswer(answer: string): string {
  let output = "";
  let cursor = 0;

  for (const match of answer.matchAll(PROTECTED_MARKDOWN)) {
    const index = match.index;
    output += redactProse(answer.slice(cursor, index));
    output += match[0];
    cursor = index + match[0].length;
  }

  return output + redactProse(answer.slice(cursor));
}

function redactProse(value: string): string {
  return value
    .replace(PHONE, (phone) => `${phone.slice(0, 3)}****${phone.slice(7)}`)
    .replace(EMAIL, (_email, local: string, domain: string) => `${local[0]}***@${domain}`);
}
