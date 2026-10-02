import { decodeEntities, htmlToText } from './text.ts';

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  published: string | null;
  guid: string | null;
}

const unwrapCdata = (value: string) => value.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');

function tagContent(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? unwrapCdata(match[1]) : null;
}

/** Items from an RSS 2.0 or Atom feed. Tolerant of missing fields; items without a link are skipped. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of blocks) {
    const atomLink = block.match(/<link\b[^>]*href="([^"]+)"/i)?.[1];
    const link = decodeEntities((tagContent(block, 'link') ?? atomLink ?? '').trim());
    if (!/^https?:\/\//i.test(link)) continue;

    items.push({
      title: htmlToText(tagContent(block, 'title')),
      link,
      description: htmlToText(tagContent(block, 'description') ?? tagContent(block, 'summary') ?? ''),
      published: (tagContent(block, 'pubDate') ?? tagContent(block, 'published') ?? tagContent(block, 'updated'))?.trim() ?? null,
      guid: tagContent(block, 'guid')?.trim() ?? tagContent(block, 'id')?.trim() ?? null,
    });
  }
  return items;
}
