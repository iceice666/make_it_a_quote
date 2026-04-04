import { Elysia, t } from 'elysia';
import type { ElysiaAdapter } from 'elysia';
import { displayAvatarURL, fetchAvatarBuffer, fetchDiscordUser, getDisplayName } from './discord';
import { buildQuoteSvg, countDisplayCharacters, getAvatarFetchSize, MAX_VISIBLE_CONTENT_LENGTH } from './generator';
import { SimpleCache } from './cache';
import { RateLimiter } from './rate-limiter';

const templateSchema = t.Union([
  t.Literal('left-half'),
  t.Literal('top-half'),
]);

export type AppRuntime = {
  name: 'bun' | 'cloudflare';
  version: string;
  renderQuoteImage(svg: string, width: number): Promise<Uint8Array> | Uint8Array;
  getBotToken(): string | undefined;
};

const imageCache = new SimpleCache<Uint8Array>(3600);
const resolveLimiter = new RateLimiter(15, 60);
const generateLimiter = new RateLimiter(10, 60);
const startedAt = Date.now();
let lastMaintenanceAt = 0;

function runMaintenance(): void {
  const now = Date.now();
  if (now - lastMaintenanceAt < 60000) {
    return;
  }

  lastMaintenanceAt = now;
  imageCache.cleanup();
  resolveLimiter.cleanup();
  generateLimiter.cleanup();
}

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(',')[0]?.trim();
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

function buildHealthPayload(runtime: AppRuntime) {
  return {
    ok: true,
    runtime: runtime.name,
    version: runtime.version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export function createApp(runtime: AppRuntime, adapter?: ElysiaAdapter): Elysia {
  const app = new Elysia({
    ...(adapter ? { adapter } : {}),
    // Cloudflare Workers disallow runtime code generation used by Elysia AOT handlers.
    aot: runtime.name !== 'cloudflare',
  });

  app.post(
    '/api/resolve',
    async ({ body, set, request }) => {
      runMaintenance();

      const clientIp = resolveClientIp(request);
      if (!resolveLimiter.isAllowed(clientIp)) {
        set.status = 429;
        const retryAfter = resolveLimiter.getRetryAfter(clientIp);
        if (retryAfter !== null) {
          set.headers['retry-after'] = String(retryAfter);
        }
        return {
          error: 'Too many requests',
          retryAfter,
        };
      }

      const botToken = runtime.getBotToken();
      if (!botToken) {
        set.status = 500;
        return {
          error: 'Failed to resolve Discord user',
          detail: 'DISCORD_BOT_TOKEN is not set.',
        };
      }

      try {
        const discordId = body.discordId.trim();
        const inputDisplayName = body.displayName?.trim();

        const user = await fetchDiscordUser(discordId, botToken);
        const displayName = (inputDisplayName || getDisplayName(user) || user.id).slice(0, 64);

        return {
          id: user.id,
          username: user.username,
          displayName,
          avatarUrl: displayAvatarURL(user, 512),
        };
      } catch (error) {
        set.status = 500;
        return {
          error: 'Failed to resolve Discord user',
          detail: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      body: t.Object({
        discordId: t.String({
          pattern: '^[0-9]{17,20}$',
        }),
        displayName: t.Optional(t.String({ maxLength: 64 })),
      }),
    },
  );

  app.post(
    '/api/generate',
    async ({ body, set, request }) => {
      runMaintenance();

      const clientIp = resolveClientIp(request);
      if (!generateLimiter.isAllowed(clientIp)) {
        set.status = 429;
        const retryAfter = generateLimiter.getRetryAfter(clientIp);
        if (retryAfter !== null) {
          set.headers['retry-after'] = String(retryAfter);
        }
        return {
          error: 'Too many requests',
          retryAfter,
        };
      }

      const botToken = runtime.getBotToken();
      if (!botToken) {
        set.status = 500;
        return {
          error: 'Failed to generate quote image',
          detail: 'DISCORD_BOT_TOKEN is not set.',
        };
      }

      try {
        const discordId = body.discordId.trim();
        const content = body.content.trim();
        const inputDisplayName = body.displayName?.trim();
        const attributionSuffix = body.attributionSuffix?.trim() ?? '';
        const template = body.template ?? 'left-half';
        const monospace = body.monospace ?? false;
        const normalizedDisplayName = inputDisplayName?.slice(0, 64) ?? '';
        const contentLength = countDisplayCharacters(content);

        if (contentLength === 0) {
          set.status = 400;
          return {
            error: 'Failed to generate quote image',
            detail: 'Quote content must include at least one visible character.',
          };
        }

        if (contentLength > MAX_VISIBLE_CONTENT_LENGTH) {
          set.status = 400;
          return {
            error: 'Failed to generate quote image',
            detail: `Quote content must be ${MAX_VISIBLE_CONTENT_LENGTH} visible characters or fewer.`,
          };
        }

        const cacheKey = `${discordId}_${normalizedDisplayName}_${content}_${template}_${attributionSuffix}_${monospace ? 'mono' : 'normal'}`;
        const cachedImage = imageCache.get(cacheKey);
        if (cachedImage) {
          set.headers['content-type'] = 'image/png';
          set.headers['cache-control'] = 'public, max-age=3600, s-maxage=3600';
          return cachedImage;
        }

        const user = await fetchDiscordUser(discordId, botToken);
        const displayName = normalizedDisplayName || (getDisplayName(user) || user.id).slice(0, 64);

        const avatar = await fetchAvatarBuffer(user, getAvatarFetchSize(template, content, { monospace }));
        const rendered = buildQuoteSvg({
          avatarBuffer: avatar.buffer,
          avatarContentType: avatar.contentType,
          content,
          displayName,
          attributionSuffix,
          userHandle: user.username,
          template,
          monospace,
        });
        const image = await runtime.renderQuoteImage(rendered.svg, rendered.width);

        imageCache.set(cacheKey, image);

        set.headers['content-type'] = 'image/png';
        set.headers['cache-control'] = 'public, max-age=3600, s-maxage=3600';
        return image;
      } catch (error) {
        set.status = 500;
        return {
          error: 'Failed to generate quote image',
          detail: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      body: t.Object({
        discordId: t.String({
          pattern: '^[0-9]{17,20}$',
        }),
        content: t.String({ minLength: 1, maxLength: 4000 }),
        displayName: t.Optional(t.String({ maxLength: 64 })),
        attributionSuffix: t.Optional(t.String({ maxLength: 80 })),
        template: t.Optional(templateSchema),
        monospace: t.Optional(t.Boolean()),
      }),
    },
  );

  app.get('/api/health', ({ set }) => {
    set.headers['cache-control'] = 'no-store';
    return buildHealthPayload(runtime);
  });

  return app;
}
