import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '../node_modules/@resvg/resvg-wasm/index_bg.wasm';
import fontBold from '../assets/fonts/NotoSansCJKtc-Bold.otf';
import fontRegular from '../assets/fonts/NotoSansCJKtc-Regular.otf';

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(resvgWasm);
  }

  return wasmReady;
}

export async function renderSvgToPng(svg: string, width: number): Promise<Uint8Array> {
  await ensureWasm();

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    font: {
      fontBuffers: [new Uint8Array(fontRegular), new Uint8Array(fontBold)],
      defaultFontFamily: 'Noto Sans CJK TC',
    },
  });

  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
