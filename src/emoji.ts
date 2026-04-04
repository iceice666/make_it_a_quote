const EMOJI_HREF_PREFIX = 'emoji://';
const EMOJI_ASSET_BASE_URL = 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/svg';

const EXTENDED_PICTOGRAPHIC_REGEX = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_REGEX = /\p{Regional_Indicator}/u;
const KEYCAP_REGEX = /\u20E3/u;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

const emojiAssetCache = new Map<string, Promise<Uint8Array>>();

export function getGraphemes(text: string): string[] {
  if (!text) {
    return [];
  }

  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
  }

  return Array.from(text);
}

export function isEmojiGrapheme(grapheme: string): boolean {
  return (
    EXTENDED_PICTOGRAPHIC_REGEX.test(grapheme) ||
    REGIONAL_INDICATOR_REGEX.test(grapheme) ||
    KEYCAP_REGEX.test(grapheme)
  );
}

export function getEmojiHref(grapheme: string): string | null {
  if (!isEmojiGrapheme(grapheme)) {
    return null;
  }

  const codePoints = Array.from(grapheme, (char) => char.codePointAt(0) ?? 0).filter(
    (codePoint) => codePoint !== 0xfe0f,
  );
  if (codePoints.length === 0) {
    return null;
  }

  return `${EMOJI_HREF_PREFIX}${codePoints.map((codePoint) => codePoint.toString(16)).join('-')}`;
}

export function isEmojiHref(href: string): boolean {
  return href.startsWith(EMOJI_HREF_PREFIX);
}

export async function loadEmojiAsset(href: string): Promise<Uint8Array> {
  if (!isEmojiHref(href)) {
    throw new Error(`Unsupported emoji asset reference: ${href}`);
  }

  const cached = emojiAssetCache.get(href);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const assetId = href.slice(EMOJI_HREF_PREFIX.length);
    const response = await fetch(`${EMOJI_ASSET_BASE_URL}/${assetId}.svg`);
    if (!response.ok) {
      throw new Error(`Failed to load emoji asset ${assetId}: ${response.status} ${response.statusText}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  })().catch((error) => {
    emojiAssetCache.delete(href);
    throw error;
  });

  emojiAssetCache.set(href, request);
  return request;
}
