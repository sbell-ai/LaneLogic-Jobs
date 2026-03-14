import { parse } from "csv-parse/sync";

export interface TsvRow {
  [key: string]: string;
}

export function parseTsv(tsvContent: string): TsvRow[] {
  if (!tsvContent || !tsvContent.trim()) return [];
  const records = parse(tsvContent, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    quote: '"',
    escape: '"',
  });
  return records as TsvRow[];
}
