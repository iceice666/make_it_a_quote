import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';

type AssetLoader = (path: string) => Promise<Uint8Array>;

const FONT_PATHS = [
  '/_worker/NotoSansCJKtc-Regular.otf',
  '/_worker/NotoSansCJKtc-Bold.otf',
  '/_worker/Noto-COLRv1.ttf',
] as const;

let wasmReady: Promise<void> | null = null;
let fontBuffersReady: Promise<Uint8Array[]> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(wasmModule as WebAssembly.Module).catch((error) => {
        wasmReady = null;
        throw error;
      });
  }

  return wasmReady;
}

function loadFontBuffers(loadAsset: AssetLoader): Promise<Uint8Array[]> {
  if (!fontBuffersReady) {
    fontBuffersReady = Promise.all(FONT_PATHS.map((path) => loadAsset(path))).catch((error) => {
      fontBuffersReady = null;
      throw error;
    });
  }

  return fontBuffersReady;
}

export async function renderSvgToPng(
  svg: string,
  width: number,
  loadAsset: AssetLoader,
): Promise<Uint8Array> {
  const wasmPromise = ensureWasm();
  const fontsPromise = loadFontBuffers(loadAsset);

  await wasmPromise;
  const [fontRegular, fontBold, fontEmoji] = await fontsPromise;

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    font: {
      fontBuffers: [fontRegular, fontBold, fontEmoji],
      defaultFontFamily: 'Noto Sans CJK TC',
    },
  });

  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
