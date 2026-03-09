import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function prettyPrintFallback(text: string): string {
  const hasMarkdown = /^#{1,6}\s|^\*\s|^-\s{1}|^\d+\.\s|^\*\*|^>\s/m.test(text);
  if (hasMarkdown) return text;

  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const labelMatch = line.match(/^([A-Z][A-Za-z\s&]+):\s*$/);
    if (labelMatch) {
      result.push(`## ${labelMatch[1]}`);
      continue;
    }
    result.push(line);
  }

  return result.join("\n");
}

interface MarkdownDescriptionProps {
  content: string;
  className?: string;
}

export default function MarkdownDescription({ content, className = "" }: MarkdownDescriptionProps) {
  const processed = prettyPrintFallback(content);

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`} data-testid="markdown-description">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["script", "iframe", "object", "embed", "form", "input"]}
        unwrapDisallowed
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
