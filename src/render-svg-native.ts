import { Resvg } from '@resvg/resvg-js';
import { isEmojiHref, loadEmojiAsset } from './emoji';

const FONT_FILES = [
  `${import.meta.dir}/public/_worker/NotoSansCJKtc-Regular.otf`,
  `${import.meta.dir}/public/_worker/NotoSansCJKtc-Bold.otf`,
  `${import.meta.dir}/public/_worker/Noto-COLRv1.ttf`,
];

export async function renderSvgToPng(svg: string, width: number): Promise<Uint8Array> {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: true,
      defaultFontFamily: 'Noto Sans CJK TC',
    },
  });

  const imageHrefs = resvg.imagesToResolve().filter(isEmojiHref);
  await Promise.all(
    imageHrefs.map(async (href) => {
      const buffer = await loadEmojiAsset(href);
      resvg.resolveImage(href, Buffer.from(buffer));
    }),
  );

  return resvg.render().asPng();
}
