export function parseSse(text: string): unknown[] {
  return text
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter(Boolean)
    .map((frame) => {
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);
      if (!data) throw new Error(`Missing data frame in ${frame}`);
      return JSON.parse(data);
    });
}
