import { initWasm, Resvg } from '@resvg/resvg-wasm';

type AssetLoader = (path: string) => Promise<Uint8Array>;

const WASM_PATH = '/_worker/index_bg.wasm';
const FONT_PATHS = [
  '/_worker/NotoSansCJKtc-Regular.otf',
  '/_worker/NotoSansCJKtc-Bold.otf',
] as const;

let wasmReady: Promise<void> | null = null;
let fontBuffersReady: Promise<Uint8Array[]> | null = null;

function ensureWasm(loadAsset: AssetLoader): Promise<void> {
  if (!wasmReady) {
    wasmReady = loadAsset(WASM_PATH)
      .then((wasmBinary) => initWasm(wasmBinary))
      .catch((error) => {
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
  const wasmPromise = ensureWasm(loadAsset);
  const fontsPromise = loadFontBuffers(loadAsset);

  await wasmPromise;
  const [fontRegular, fontBold] = await fontsPromise;

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    font: {
      fontBuffers: [fontRegular, fontBold],
      defaultFontFamily: 'Noto Sans CJK TC',
    },
  });

  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
