import { Resvg } from '@resvg/resvg-js';

const FONT_FILES = [
  `${import.meta.dir}/../assets/fonts/NotoSansCJKtc-Regular.otf`,
  `${import.meta.dir}/../assets/fonts/NotoSansCJKtc-Bold.otf`,
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
