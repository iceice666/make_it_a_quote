import { getEmojiHref, getGraphemes, isEmojiGrapheme } from './emoji';

const LANDSCAPE_RATIO = 2;
const MIN_HEIGHT = 420;
const MAX_LAYOUT_ATTEMPTS = 1000;
const HEIGHT_STEP = 48;
const MIN_TEXT_FONT_SIZE = 10;
const EMOJI_GRAPHEME_WIDTH = 1.12;
const ZERO_ADVANCE_CHARACTER_REGEX = /[\p{Mark}\p{Default_Ignorable_Code_Point}]/u;

export const MAX_VISIBLE_CONTENT_LENGTH = 500;

export const TEMPLATE_VARIANTS = ['left-half', 'top-half'] as const;
export type TemplateVariant = (typeof TEMPLATE_VARIANTS)[number];

type RenderDimensions = {
  width: number;
  height: number;
};

type TextBlockLayout = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  quoteHeight: number;
  attributionLine1Size: number;
  attributionLine2Size: number;
  attributionGap: number;
  contentGap: number;
  totalHeight: number;
};

type LeftHalfLayout = RenderDimensions & {
  type: 'left-half';
  imageWidth: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  quoteCenterX: number;
  quoteX: number;
  quoteY: number;
  signatureY: number;
  text: TextBlockLayout;
};

type TopHalfLayout = RenderDimensions & {
  type: 'top-half';
  imageHeight: number;
  contentY: number;
  contentHeight: number;
  contentWidth: number;
  quoteCenterX: number;
  quoteX: number;
  quoteY: number;
  signatureY: number;
  text: TextBlockLayout;
};

type ComputedLayout = LeftHalfLayout | TopHalfLayout;

type TextMeasureOptions = {
  monospace?: boolean;
};

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isLineBreakGrapheme(grapheme: string): boolean {
  return grapheme === '\n' || grapheme === '\r' || grapheme === '\r\n';
}

function isZeroAdvanceCharacter(char: string): boolean {
  return ZERO_ADVANCE_CHARACTER_REGEX.test(char);
}

function hasCountableGlyph(grapheme: string): boolean {
  if (isEmojiGrapheme(grapheme) || isLineBreakGrapheme(grapheme)) {
    return true;
  }

  for (const char of grapheme) {
    if (!isZeroAdvanceCharacter(char)) {
      return true;
    }
  }

  return false;
}

export function countDisplayCharacters(text: string): number {
  let count = 0;

  for (const grapheme of getGraphemes(text)) {
    if (hasCountableGlyph(grapheme)) {
      count += 1;
    }
  }

  return count;
}

function getCharacterWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 0x7F) return 0.5;
  if (code <= 0x024F) return 0.5;
  if (code <= 0x2000) return 0.55;
  if (code <= 0x206F) return 0.5;
  if (code <= 0x20CF) return 0.55;
  if (code <= 0x2E7F) return 0.5;
  if (code <= 0x2FFF) return 0.55;
  if (code <= 0x3000) return 0.5;
  if (code <= 0x303F) return 1.0;
  if (code <= 0x309F) return 1.0;
  if (code <= 0x30FF) return 1.0;
  if (code <= 0x312F) return 1.0;
  if (code <= 0x318F) return 0.55;
  if (code <= 0x319F) return 1.0;
  if (code <= 0x31BF) return 0.55;
  if (code <= 0x31EF) return 1.0;
  if (code <= 0x32FF) return 1.0;
  if (code <= 0xA4CF) return 1.0;
  if (code <= 0xA4FF) return 0.55;
  if (code <= 0xA6FF) return 0.5;
  if (code <= 0xA7FF) return 0.55;
  if (code <= 0xA8FF) return 0.5;
  if (code <= 0xABFF) return 0.55;
  if (code <= 0xAC00) return 0.5;
  if (code <= 0xD7AF) return 1.0;
  if (code <= 0xD7FF) return 0.5;
  if (code <= 0xF9FF) return 1.0;
  if (code <= 0xFAFF) return 0.5;
  if (code <= 0xFE1F) return 1.0;
  if (code <= 0xFE2F) return 0.5;
  if (code <= 0xFE6F) return 1.0;
  if (code <= 0xFEFF) return 0.5;
  if (code <= 0xFF00) return 0.55;
  if (code <= 0xFF60) return 1.0;
  if (code <= 0xFFE0) return 1.0;
  if (code <= 0x1F000) return 0.5;
  if (code <= 0x1F02F) return 1.0;
  if (code <= 0x1F0FF) return 0.5;
  if (code <= 0x1F2FF) return 1.0;
  if (code <= 0x1F77F) return 0.5;
  if (code <= 0x1F7FF) return 1.0;
  if (code <= 0x1FFFF) return 0.5;
  if (code <= 0x2FFFF) return 1.0;
  return 0.5;
}

function getGraphemeWidth(grapheme: string, options: TextMeasureOptions = {}): number {
  if (isLineBreakGrapheme(grapheme)) {
    return 0;
  }

  if (isEmojiGrapheme(grapheme)) {
    return options.monospace ? 1 : EMOJI_GRAPHEME_WIDTH;
  }

  if (options.monospace) {
    return hasCountableGlyph(grapheme) ? 1 : 0;
  }

  let width = 0;
  for (const char of grapheme) {
    if (isZeroAdvanceCharacter(char)) {
      continue;
    }

    width += getCharacterWidth(char);
  }
  return width;
}

function getTextWidth(text: string, options: TextMeasureOptions = {}): number {
  let width = 0;
  for (const grapheme of getGraphemes(text)) {
    width += getGraphemeWidth(grapheme, options);
  }
  return width;
}

function trimLineEnd(line: string): string {
  return line.replace(/[ \t]+$/g, '');
}

function truncateLineToWidth(line: string, maxWidth: number, options: TextMeasureOptions = {}, suffix = '...'): string {
  const suffixWidth = getTextWidth(suffix, options);
  const graphemes = getGraphemes(trimLineEnd(line));

  while (graphemes.length > 0 && getTextWidth(graphemes.join(''), options) + suffixWidth > maxWidth) {
    graphemes.pop();
  }

  const truncated = trimLineEnd(graphemes.join(''));

  return truncated ? `${truncated}${suffix}` : suffix;
}

function pushWrappedToken(params: {
  token: string;
  maxWidth: number;
  maxLines: number;
  lines: string[];
  currentLine: string;
  truncated: boolean;
  options?: TextMeasureOptions;
}): { currentLine: string; truncated: boolean } {
  const { token, maxWidth, maxLines, lines, truncated, options = {} } = params;
  let { currentLine } = params;

  if (truncated) {
    return { currentLine, truncated };
  }

  const normalizedToken = /^\s+$/.test(token) ? ' ' : token;
  if (normalizedToken === ' ' && !currentLine) {
    return { currentLine, truncated };
  }

  const candidate = currentLine + normalizedToken;
  if (getTextWidth(candidate, options) <= maxWidth) {
    return { currentLine: candidate, truncated };
  }

  if (currentLine) {
    lines.push(trimLineEnd(currentLine));
    if (lines.length >= maxLines) {
      lines[maxLines - 1] = truncateLineToWidth(lines[maxLines - 1], maxWidth, options);
      return { currentLine: '', truncated: true };
    }
    currentLine = normalizedToken === ' ' ? '' : normalizedToken;
    if (currentLine && getTextWidth(currentLine, options) <= maxWidth) {
      return { currentLine, truncated };
    }
  } else if (normalizedToken === ' ') {
    return { currentLine, truncated };
  }

  let fragment = '';
  for (const grapheme of getGraphemes(normalizedToken)) {
    const next = fragment + grapheme;
    if (fragment && getTextWidth(next, options) > maxWidth) {
      lines.push(trimLineEnd(fragment));
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = truncateLineToWidth(lines[maxLines - 1], maxWidth, options);
        return { currentLine: '', truncated: true };
      }
      fragment = grapheme === ' ' ? '' : grapheme;
    } else {
      fragment = next;
    }
  }

  return { currentLine: fragment, truncated };
}

function wrapText(
  content: string,
  maxWidth: number,
  options: TextMeasureOptions = {},
  maxLines = Number.POSITIVE_INFINITY,
): { lines: string[]; truncated: boolean } {
  const normalized = content.trim().replace(/\r\n?/g, '\n');
  const lines: string[] = [];
  let currentLine = '';
  let truncated = false;

  const paragraphs = normalized.split('\n');

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex];
    const tokens = paragraph.length > 0 ? paragraph.split(/(\s+)/).filter(Boolean) : [''];

    for (const token of tokens) {
      const result = pushWrappedToken({
        token,
        maxWidth,
        maxLines,
        lines,
        currentLine,
        truncated,
        options,
      });
      currentLine = result.currentLine;
      truncated = result.truncated;
      if (truncated) {
        return { lines, truncated: true };
      }
    }

    if (paragraphIndex < paragraphs.length - 1) {
      lines.push(trimLineEnd(currentLine));
      currentLine = '';
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = truncateLineToWidth(lines[maxLines - 1], maxWidth, options);
        return { lines, truncated: true };
      }
    }
  }

  if (currentLine || lines.length === 0) {
    lines.push(trimLineEnd(currentLine));
  }

  return { lines, truncated };
}

function base64ArrayBuffer(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function buildAttribution(params: {
  displayName: string;
  userHandle: string;
  attributionSuffix?: string;
}): { line1: string; line2: string } {
  const { displayName, userHandle, attributionSuffix = '' } = params;
  const suffix = attributionSuffix ? ` ${attributionSuffix}` : '';
  return {
    line1: `- ${displayName}${suffix}`,
    line2: `@${userHandle}`,
  };
}

function renderInlineText(params: {
  line: string;
  x: number;
  y: number;
  color: string;
  size: number;
  weight: number;
  anchor?: 'start' | 'middle' | 'end';
  monospace?: boolean;
}): string {
  const { line, x, y, color, size, weight, anchor = 'start', monospace = false } = params;
  const graphemes = getGraphemes(line);
  const lineWidth = getTextWidth(line, { monospace }) * size;
  const startX = anchor === 'middle' ? x - lineWidth / 2 : anchor === 'end' ? x - lineWidth : x;
  const nodes: string[] = [];

  if (monospace) {
    let cursorWidth = 0;

    for (const grapheme of graphemes) {
      const graphemeWidth = getGraphemeWidth(grapheme, { monospace: true });
      if (graphemeWidth <= 0) {
        continue;
      }

      const glyphX = roundPx(startX + cursorWidth * size);
      const glyphWidth = roundPx(graphemeWidth * size);
      const emojiHref = getEmojiHref(grapheme);

      if (emojiHref) {
        nodes.push(
          `<image href="${emojiHref}" x="${glyphX}" y="${roundPx(y - size * 0.93)}" width="${glyphWidth}" height="${glyphWidth}" preserveAspectRatio="xMidYMid meet" />`,
        );
      } else if (!/^\s+$/.test(grapheme)) {
        nodes.push(
          `<text x="${glyphX}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="start" textLength="${glyphWidth}" lengthAdjust="spacingAndGlyphs">${escapeXml(grapheme)}</text>`,
        );
      }

      cursorWidth += graphemeWidth;
    }

    return nodes.join('');
  }

  let cursorWidth = 0;
  let bufferedText = '';
  let bufferedTextStart = 0;

  const flushBufferedText = () => {
    if (!bufferedText) {
      return;
    }

    nodes.push(
      `<text x="${roundPx(startX + bufferedTextStart * size)}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="start">${escapeXml(bufferedText)}</text>`,
    );
    bufferedText = '';
  };

  for (const grapheme of graphemes) {
    const emojiHref = getEmojiHref(grapheme);
    if (emojiHref) {
      flushBufferedText();
      const emojiSize = roundPx(getGraphemeWidth(grapheme) * size);
      nodes.push(
        `<image href="${emojiHref}" x="${roundPx(startX + cursorWidth * size)}" y="${roundPx(y - size * 0.93)}" width="${emojiSize}" height="${emojiSize}" preserveAspectRatio="xMidYMid meet" />`,
      );
    } else {
      if (!bufferedText) {
        bufferedTextStart = cursorWidth;
      }
      bufferedText += grapheme;
    }

    cursorWidth += getGraphemeWidth(grapheme);
  }

  flushBufferedText();
  return nodes.join('');
}

function renderTextLines(params: {
  lines: string[];
  x: number;
  y: number;
  lineHeight: number;
  color: string;
  size: number;
  weight: number;
  anchor?: 'start' | 'middle' | 'end';
  monospace?: boolean;
}): string {
  const { lines, x, y, lineHeight, color, size, weight, anchor = 'start', monospace = false } = params;
  return lines
    .map((line, idx) => renderInlineText({
      line,
      x,
      y: y + idx * lineHeight,
      color,
      size,
      weight,
      anchor,
      monospace,
    }))
    .join('');
}

function roundPx(value: number): number {
  return Math.round(value * 100) / 100;
}

function getLandscapeDimensions(height: number): RenderDimensions {
  const normalizedHeight = Math.max(MIN_HEIGHT, Math.ceil(height));
  return {
    height: normalizedHeight,
    width: Math.round(normalizedHeight * LANDSCAPE_RATIO),
  };
}

function getTopHalfDimensions(width: number, contentHeight: number): RenderDimensions & { imageHeight: number } {
  const normalizedWidth = Math.max(MIN_HEIGHT, Math.ceil(width));
  const imageHeight = Math.round(normalizedWidth * 0.94);
  return {
    width: normalizedWidth,
    height: imageHeight + Math.max(160, Math.ceil(contentHeight)),
    imageHeight,
  };
}

function buildTextBlockLayout(params: {
  content: string;
  availableWidth: number;
  availableHeight: number;
  minFontSize: number;
  maxFontSize: number;
  lineHeightRatio: number;
  options?: TextMeasureOptions;
}): TextBlockLayout | null {
  const { content, availableWidth, availableHeight, minFontSize, maxFontSize, lineHeightRatio, options = {} } = params;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const maxWidth = availableWidth / fontSize;
    const wrapped = wrapText(content, maxWidth, options);
    const lineHeight = Math.ceil(fontSize * lineHeightRatio);
    const quoteHeight = wrapped.lines.length * lineHeight;
    const attributionLine1Size = Math.max(18, Math.round(fontSize * 0.68));
    const attributionLine2Size = Math.max(16, Math.round(fontSize * 0.6));
    const attributionGap = Math.max(18, Math.round(fontSize * 0.58));
    const contentGap = Math.max(18, Math.round(fontSize * 0.72));
    const totalHeight = quoteHeight + contentGap + attributionLine1Size + attributionGap + attributionLine2Size;

    if (totalHeight <= availableHeight) {
      return {
        fontSize,
        lineHeight,
        lines: wrapped.lines,
        quoteHeight,
        attributionLine1Size,
        attributionLine2Size,
        attributionGap,
        contentGap,
        totalHeight,
      };
    }
  }

  return null;
}

function computeLeftHalfLayout(content: string, options: TextMeasureOptions = {}): LeftHalfLayout {
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const dimensions = getLandscapeDimensions(MIN_HEIGHT + attempt * HEIGHT_STEP);
    const imageWidth = Math.round(dimensions.width * 0.49);
    const textColumnWidth = dimensions.width - imageWidth;
    const contentX = imageWidth + Math.round(dimensions.width * 0.02);
    const contentY = Math.round(dimensions.height * 0.03);
    const contentWidth = Math.round(textColumnWidth - dimensions.width * 0.04);
    const contentHeight = Math.round(dimensions.height - dimensions.height * 0.06);
    const availableWidth = Math.round(contentWidth * 0.9);
    const availableHeight = Math.round(contentHeight * 0.92);
    const text = buildTextBlockLayout({
      content,
      availableWidth,
      availableHeight,
      minFontSize: MIN_TEXT_FONT_SIZE,
      maxFontSize: 34,
      lineHeightRatio: 1.18,
      options,
    });

    if (text) {
      const quoteCenterX = contentX + Math.round(contentWidth / 2);
      const quoteX = quoteCenterX;
      const quoteY = contentY + Math.round((contentHeight - text.totalHeight) / 2) + text.fontSize;
      const signatureY = quoteY + text.quoteHeight + text.contentGap;
      return {
        type: 'left-half',
        ...dimensions,
        imageWidth,
        contentX,
        contentY,
        contentWidth,
        contentHeight,
        quoteCenterX,
        quoteX,
        quoteY,
        signatureY,
        text,
      };
    }
  }

  throw new Error('Unable to fit quote into left-half layout');
}

function computeTopHalfLayout(content: string, options: TextMeasureOptions = {}): TopHalfLayout {
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const targetWidth = MIN_HEIGHT + attempt * HEIGHT_STEP;
    const horizontalPadding = Math.max(22, Math.round(targetWidth * 0.06));
    const verticalPadding = Math.max(32, Math.round(targetWidth * 0.08));
    const availableWidth = Math.max(120, targetWidth - horizontalPadding * 2);
    const text = buildTextBlockLayout({
      content,
      availableWidth,
      availableHeight: Number.POSITIVE_INFINITY,
      minFontSize: MIN_TEXT_FONT_SIZE,
      maxFontSize: 32,
      lineHeightRatio: 1.16,
      options,
    });

    if (text) {
      const contentHeight = text.totalHeight + verticalPadding * 2;
      const dimensions = getTopHalfDimensions(targetWidth, contentHeight);
      const contentY = dimensions.imageHeight;
      const quoteCenterX = Math.round(dimensions.width / 2);
      const quoteX = quoteCenterX;
      const quoteY =
        contentY +
        verticalPadding +
        text.fontSize;
      const signatureY = quoteY + text.quoteHeight + text.contentGap;
      return {
        type: 'top-half',
        ...dimensions,
        imageHeight: dimensions.imageHeight,
        contentY,
        contentHeight,
        contentWidth: dimensions.width,
        quoteCenterX,
        quoteX,
        quoteY,
        signatureY,
        text,
      };
    }
  }

  throw new Error('Unable to fit quote into top-half layout');
}

function computeLayout(template: TemplateVariant, content: string, options: TextMeasureOptions = {}): ComputedLayout {
  if (template === 'top-half') {
    return computeTopHalfLayout(content, options);
  }

  return computeLeftHalfLayout(content, options);
}

export function getAvatarFetchSize(template: TemplateVariant, content: string, options: TextMeasureOptions = {}): number {
  const layout = computeLayout(template, content, options);
  return layout.type === 'top-half' ? layout.imageHeight : layout.height;
}

function renderLeftHalfLayout(
  avatarData: string,
  attribution: { line1: string; line2: string },
  layout: LeftHalfLayout,
  monospace = false,
): string {
  const textNodes = renderTextLines({
    lines: layout.text.lines,
    x: layout.quoteX,
    y: layout.quoteY,
    lineHeight: layout.text.lineHeight,
    color: '#ecf0f3',
    size: layout.text.fontSize,
    weight: 600,
    anchor: 'middle',
    monospace,
  });

  return `
  <defs>
    <linearGradient id="leftShade" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(6,9,12,0.78)" />
      <stop offset="100%" stop-color="rgba(6,9,12,0.2)" />
    </linearGradient>
    <linearGradient id="avatarEdgeFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.92)" />
    </linearGradient>
    <linearGradient id="contentEdgeFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0.88)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>
  </defs>
  <rect width="${layout.width}" height="${layout.height}" fill="#000000" />
  <image href="${avatarData}" x="0" y="0" width="${layout.imageWidth}" height="${layout.height}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${layout.imageWidth}" height="${layout.height}" fill="url(#leftShade)" />
  <rect
    x="${Math.max(0, layout.imageWidth - Math.round(layout.width * 0.08))}"
    y="0"
    width="${Math.round(layout.width * 0.08)}"
    height="${layout.height}"
    fill="url(#avatarEdgeFade)"
  />
  <rect x="${layout.imageWidth}" y="0" width="${layout.width - layout.imageWidth}" height="${layout.height}" fill="#000000" />
  <rect
    x="${layout.imageWidth}"
    y="0"
    width="${Math.round(layout.width * 0.07)}"
    height="${layout.height}"
    fill="url(#contentEdgeFade)"
  />
  <g>
    ${textNodes}
    ${renderInlineText({
      line: attribution.line1,
      x: layout.quoteX,
      y: layout.signatureY,
      color: '#98a6b3',
      size: layout.text.attributionLine1Size,
      weight: 500,
      anchor: 'middle',
      monospace,
    })}
    ${renderInlineText({
      line: attribution.line2,
      x: layout.quoteX,
      y: layout.signatureY + layout.text.attributionGap,
      color: '#98a6b3',
      size: layout.text.attributionLine2Size,
      weight: 500,
      anchor: 'middle',
      monospace,
    })}
  </g>`;
}

function renderTopHalfLayout(
  avatarData: string,
  attribution: { line1: string; line2: string },
  layout: TopHalfLayout,
  monospace = false,
): string {
  const textNodes = renderTextLines({
    lines: layout.text.lines,
    x: layout.quoteX,
    y: layout.quoteY,
    lineHeight: layout.text.lineHeight,
    color: '#f3f5f7',
    size: layout.text.fontSize,
    weight: 600,
    anchor: 'middle',
    monospace,
  });

  return `
  <defs>
    <linearGradient id="overlayTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.12)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.52)" />
    </linearGradient>
    <linearGradient id="avatarBottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.94)" />
    </linearGradient>
    <linearGradient id="contentTopFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.92)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>
  </defs>
  <rect width="${layout.width}" height="${layout.height}" fill="#000000" />
  <rect x="0" y="0" width="${layout.width}" height="${layout.imageHeight}" fill="#000000" />
  <image href="${avatarData}" x="0" y="0" width="${layout.width}" height="${layout.imageHeight}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${layout.width}" height="${layout.imageHeight}" fill="url(#overlayTop)" />
  <rect
    x="0"
    y="${Math.max(0, layout.imageHeight - Math.round(layout.height * 0.12))}"
    width="${layout.width}"
    height="${Math.round(layout.height * 0.12)}"
    fill="url(#avatarBottomFade)"
  />
  <rect x="0" y="${layout.imageHeight}" width="${layout.width}" height="${layout.height - layout.imageHeight}" fill="#000000" />
  <rect
    x="0"
    y="${layout.imageHeight}"
    width="${layout.width}"
    height="${Math.round(layout.height * 0.1)}"
    fill="url(#contentTopFade)"
  />
  <g>
    ${textNodes}
    ${renderInlineText({
      line: attribution.line1,
      x: layout.quoteX,
      y: layout.signatureY,
      color: '#9fb0bc',
      size: layout.text.attributionLine1Size,
      weight: 500,
      anchor: 'middle',
      monospace,
    })}
    ${renderInlineText({
      line: attribution.line2,
      x: layout.quoteX,
      y: layout.signatureY + layout.text.attributionGap,
      color: '#9fb0bc',
      size: layout.text.attributionLine2Size,
      weight: 500,
      anchor: 'middle',
      monospace,
    })}
  </g>`;
}

function renderLayout(params: {
  template: TemplateVariant;
  avatarData: string;
  content: string;
  displayName: string;
  attributionSuffix: string;
  userHandle: string;
  monospace?: boolean;
}): { body: string; width: number; height: number } {
  const { template, avatarData, content, displayName, attributionSuffix, userHandle, monospace = false } = params;
  const attribution = buildAttribution({
    displayName,
    attributionSuffix,
    userHandle,
  });
  const layout = computeLayout(template, content, { monospace });

  if (layout.type === 'top-half') {
    return {
      body: renderTopHalfLayout(avatarData, attribution, layout, monospace),
      width: layout.width,
      height: layout.height,
    };
  }

  return {
    body: renderLeftHalfLayout(avatarData, attribution, layout, monospace),
    width: layout.width,
    height: layout.height,
  };
}

export type QuoteImageInput = {
  avatarBuffer: ArrayBuffer;
  avatarContentType: string;
  content: string;
  displayName: string;
  attributionSuffix?: string;
  userHandle: string;
  template: TemplateVariant;
  monospace?: boolean;
};

export function buildQuoteSvg(params: QuoteImageInput): { svg: string; width: number; height: number } {
  const {
    avatarBuffer,
    avatarContentType,
    content,
    displayName,
    attributionSuffix = '',
    userHandle,
    template,
    monospace = false,
  } = params;

  const avatarData = `data:${avatarContentType};base64,${base64ArrayBuffer(avatarBuffer)}`;
  const rendered = renderLayout({
    template,
    avatarData,
    content,
    displayName,
    attributionSuffix,
    userHandle,
    monospace,
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${rendered.width}" height="${rendered.height}" viewBox="0 0 ${rendered.width} ${rendered.height}" xmlns="http://www.w3.org/2000/svg">
  <g font-family="Noto Sans CJK TC, Noto Sans TC, Noto Color Emoji, Noto Sans Emoji, Segoe UI Emoji, Apple Color Emoji, Segoe UI, Helvetica Neue, Arial, sans-serif">
    ${rendered.body}
  </g>
</svg>`;

  return {
    svg,
    width: rendered.width,
    height: rendered.height,
  };
}
