import { decodeEntities, htmlToText } from './text.ts';

export interface FeedImage {
  url: string;
  /** Photographer or rights holder, as the publisher gives it */
  credit: string | null;
}

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  published: string | null;
  guid: string | null;
  /** The image the publisher attached to this article, if any */
  image: FeedImage | null;
}

const unwrapCdata = (value: string) => value.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');

function tagContent(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? unwrapCdata(match[1]) : null;
}

function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

const isImageUrl = (url: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);

/**
 * The image the publisher attached to this item: Media RSS content or thumbnail, an image
 * enclosure, or the image in the description. Only https images; never a guessed image.
 */
function itemImage(block: string, rawDescription: string): FeedImage | null {
  const candidates: string[] = [];
  for (const tag of block.match(/<media:content\b[^>]*>/gi) ?? []) {
    const a = attributes(tag);
    if (a.url && (a.medium === 'image' || a.type?.startsWith('image/') || isImageUrl(a.url))) candidates.push(a.url);
  }
  for (const tag of block.match(/<media:thumbnail\b[^>]*>/gi) ?? []) candidates.push(attributes(tag).url ?? '');
  for (const tag of block.match(/<enclosure\b[^>]*>/gi) ?? []) {
    const a = attributes(tag);
    if (a.url && (a.type?.startsWith('image/') || isImageUrl(a.url))) candidates.push(a.url);
  }
  const imgInDescription = decodeEntities(rawDescription).match(/<img\b[^>]*>/i)?.[0];
  if (imgInDescription) candidates.push(attributes(imgInDescription).src ?? '');

  const url = candidates.find((c) => /^https:\/\//i.test(c));
  if (!url) return null;
  const credit = htmlToText(tagContent(block, 'media:credit') ?? tagContent(block, 'media:copyright') ?? '');
  return { url, credit: credit || null };
}

/** Items from an RSS 2.0 or Atom feed. Tolerant of missing fields; items without a link are skipped. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of blocks) {
    const atomLink = block.match(/<link\b[^>]*href="([^"]+)"/i)?.[1];
    const link = decodeEntities((tagContent(block, 'link') ?? atomLink ?? '').trim());
    if (!/^https?:\/\//i.test(link)) continue;

    const rawDescription = tagContent(block, 'description') ?? tagContent(block, 'summary') ?? '';
    items.push({
      title: htmlToText(tagContent(block, 'title')),
      link,
      description: htmlToText(rawDescription),
      published: (tagContent(block, 'pubDate') ?? tagContent(block, 'published') ?? tagContent(block, 'updated'))?.trim() ?? null,
      guid: tagContent(block, 'guid')?.trim() ?? tagContent(block, 'id')?.trim() ?? null,
      image: itemImage(block, rawDescription),
    });
  }
  return items;
}
