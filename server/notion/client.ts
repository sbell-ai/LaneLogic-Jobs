import { Client } from "@notionhq/client";

function getClient(): Client {
  if (!process.env.NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN is not set. Please add your Notion integration token as a secret.");
  }
  return new Client({ auth: process.env.NOTION_TOKEN });
}

export function pageIdFromUrl(url: string): string {
  const match = url.match(/([a-f0-9]{32})(?:[?#].*)?$/i);
  if (match) return match[1];
  throw new Error(`Cannot extract page ID from Notion URL: ${url}`);
}

export async function notionGetPage(pageId: string): Promise<any> {
  return getClient().pages.retrieve({ page_id: pageId });
}

export async function notionGetAllBlocks(blockId: string): Promise<any[]> {
  const client = getClient();
  const all: any[] = [];
  let cursor: string | undefined;

  do {
    const res = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    all.push(...res.results);
    cursor = res.next_cursor ?? undefined;
  } while (cursor);

  return all;
}
