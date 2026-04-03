import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApp, type AppRuntime } from './app';
import { renderSvgToPng } from './render-svg-wasm';

type Env = {
  DISCORD_BOT_TOKEN?: string;
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

const version = '0.1.0';
let app: ReturnType<typeof createApp> | null = null;

function getApp(env: Env) {
  if (!app) {
    const runtime: AppRuntime = {
      name: 'cloudflare',
      version,
      renderQuoteImage: renderSvgToPng,
      getBotToken: () => env.DISCORD_BOT_TOKEN,
    };

    app = createApp(runtime, CloudflareAdapter);
  }

  return app;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    return getApp(env).fetch(request);
  },
};
