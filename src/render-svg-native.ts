import { Resvg } from '@resvg/resvg-js';

const FONT_FILES = [
  `${import.meta.dir}/public/_worker/NotoSansCJKtc-Regular.otf`,
  `${import.meta.dir}/public/_worker/NotoSansCJKtc-Bold.otf`,
  `${import.meta.dir}/public/_worker/Noto-COLRv1.ttf`,
];

export function renderSvgToPng(svg: string, width: number): Uint8Array {
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

  return resvg.render().asPng();
}
