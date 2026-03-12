export function tokenize(text: string): Array<{ type: "text" | "url"; value: string }> {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const tokens: Array<{ type: "text" | "url"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "url", value: match[0] });
    lastIndex = urlPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}
