import { SimpleCache } from './cache';

const DISCORD_CDN = 'https://cdn.discordapp.com';
const DISCORD_API = 'https://discord.com/api/v10';

const userCache = new SimpleCache<DiscordUser>(600);
const avatarCache = new SimpleCache<{ buffer: ArrayBuffer; contentType: string }>(3600);
const pendingUserRequests = new Map<string, Promise<DiscordUser>>();
const pendingAvatarRequests = new Map<string, Promise<{ buffer: ArrayBuffer; contentType: string }>>();

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
};

function getDefaultAvatarIndex(discordId: string): number {
  const shifted = BigInt(discordId) >> 22n;
  return Number(shifted % 6n);
}

function normalizeSize(size: number): number {
  if (!Number.isFinite(size)) {
    return 128;
  }

  return Math.min(4096, Math.max(16, Math.round(size)));
}

function pickExtension(hash: string): 'gif' | 'png' {
  return hash.startsWith('a_') ? 'gif' : 'png';
}

function getAuthHeaders(botToken: string): HeadersInit {
  return {
    authorization: `Bot ${botToken}`,
  };
}

export async function fetchDiscordUser(discordId: string, botToken: string): Promise<DiscordUser> {
  const cached = userCache.get(discordId);
  if (cached) return cached;

  const pendingRequest = pendingUserRequests.get(discordId);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const response = await fetch(`${DISCORD_API}/users/${discordId}`, {
      headers: getAuthHeaders(botToken),
    });

    if (!response.ok) {
      throw new Error(`Discord API user lookup failed (${response.status})`);
    }

    const user = (await response.json()) as DiscordUser;
    userCache.set(discordId, user);
    return user;
  })();

  pendingUserRequests.set(discordId, request);

  try {
    return await request;
  } finally {
    pendingUserRequests.delete(discordId);
  }
}

function buildDefaultAvatarUrl(discordId: string, size = 128): string {
  const index = getDefaultAvatarIndex(discordId);
  return `${DISCORD_CDN}/embed/avatars/${index}.png?size=${normalizeSize(size)}`;
}

export function getDisplayName(user: DiscordUser): string {
  return user.global_name ?? user.username;
}

export function displayAvatarURL(user: Pick<DiscordUser, 'id' | 'avatar'>, size = 128): string {
  const normalizedSize = normalizeSize(size);
  const avatarHash = user.avatar;
  if (avatarHash) {
    const ext = pickExtension(avatarHash);
    return `${DISCORD_CDN}/avatars/${user.id}/${avatarHash}.${ext}?size=${normalizedSize}`;
  }

  return buildDefaultAvatarUrl(user.id, normalizedSize);
}

export async function fetchAvatarBuffer(
  user: Pick<DiscordUser, 'id' | 'avatar'>,
  size = 128,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const cacheKey = `${user.id}_${size}`;
  const cached = avatarCache.get(cacheKey);
  if (cached) return cached;

  const pendingRequest = pendingAvatarRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const url = displayAvatarURL(user, size);
    const response = await fetch(url);

    if (!response.ok) {
      const fallback = await fetch(buildDefaultAvatarUrl(user.id, size));
      if (!fallback.ok) {
        throw new Error(`Failed to fetch avatar for Discord ID ${user.id}`);
      }
      const result = {
        buffer: await fallback.arrayBuffer(),
        contentType: fallback.headers.get('content-type') ?? 'image/png',
      };
      avatarCache.set(cacheKey, result);
      return result;
    }

    const result = {
      buffer: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') ?? 'image/png',
    };
    avatarCache.set(cacheKey, result);
    return result;
  })();

  pendingAvatarRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingAvatarRequests.delete(cacheKey);
  }
}
