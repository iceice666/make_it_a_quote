import { createApp, type AppRuntime } from './app';
import { renderSvgToPng } from './render-svg-native';

const publicDir = `${import.meta.dir}/public`;
const version = process.env.npm_package_version ?? '0.1.0';

function buildAssetHeaders(contentType: string, cacheControl: string): Record<string, string> {
  return {
    'content-type': contentType,
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  };
}

function serveStatic(request: Request): Response | null {
  const { pathname } = new URL(request.url);

  if (request.method !== 'GET') {
    return null;
  }

  if (pathname === '/') {
    return new Response(Bun.file(`${publicDir}/index.html`), {
      headers: buildAssetHeaders('text/html; charset=utf-8', 'public, max-age=300'),
    });
  }

  if (pathname === '/app.js') {
    return new Response(Bun.file(`${publicDir}/app.js`), {
      headers: buildAssetHeaders('application/javascript; charset=utf-8', 'public, max-age=31536000, immutable'),
    });
  }

  return null;
}

const runtime: AppRuntime = {
  name: 'bun',
  version,
  renderQuoteImage: renderSvgToPng,
  getBotToken: () => Bun.env.DISCORD_BOT_TOKEN,
};

const app = createApp(runtime);
const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch(request) {
    const staticResponse = serveStatic(request);
    if (staticResponse) {
      return staticResponse;
    }

    return app.fetch(request);
  },
});

console.log(`Quote generator running at http://localhost:${port}`);
