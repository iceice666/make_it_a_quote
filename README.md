# Make It A Quote

Generate stylized quote images from a Discord user profile and a piece of quote text. The project ships with a small web UI, a Bun server for local development, and a Cloudflare Worker entrypoint for deployment.

## What It Does

- Looks up a Discord user with a bot token
- Fetches the user's avatar
- Renders a quote card as SVG
- Converts the SVG to PNG
- Serves both a browser UI and JSON/image API endpoints

Two image layouts are supported:

- `left-half`
- `top-half`

## Stack

- Bun for local development and serving static assets
- Elysia for the API
- `@resvg/resvg-js` for native PNG rendering in Bun
- `@resvg/resvg-wasm` for PNG rendering in Cloudflare Workers
- Wrangler for Cloudflare Worker development and deploys

## Requirements

- Bun
- A Discord bot token with permission to fetch user profiles

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Set `DISCORD_BOT_TOKEN` in `.env`.

4. Start the local server:

```bash
bun run dev
```

The app runs on `http://localhost:3000` by default.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_BOT_TOKEN` | Yes | - | Used for Discord API user lookup |
| `PORT` | No | `3000` | Port for the Bun server |

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the local Bun server with watch mode |
| `bun run start` | Start the local Bun server once |
| `bun run check` | Run TypeScript type checking |
| `bun run cf:dev` | Run the Cloudflare Worker locally with Wrangler |
| `bun run cf:deploy` | Deploy the Worker with Wrangler |

## API

Base path: `/api`

### `POST /api/generate`

Generates a PNG quote image.

Example request:

```json
{
  "discordId": "123456789012345678",
  "content": "電爆所有人",
  "displayName": "Prof. Kohiro",
  "attributionSuffix": "沒說過",
  "template": "left-half",
  "monospace": false
}
```

Success response:

- `200 OK`
- `Content-Type: image/png`

### `POST /api/resolve`

Resolves a Discord profile for preview use.

Example request:

```json
{
  "discordId": "123456789012345678",
  "displayName": "su2u4"
}
```

Example response:

```json
{
  "id": "123456789012345678",
  "username": "wywywywywy",
  "displayName": "Wy | 我儘量不爆言 真的",
  "avatarUrl": "https://cdn.discordapp.com/..."
}
```

### `GET /api/health`

Returns basic service health information.

For the full API contract, see [`API.md`](./API.md).

## Rate Limits And Caching

- `/api/resolve`: 15 requests per IP per 60 seconds
- `/api/generate`: 10 requests per IP per 60 seconds
- Generated PNGs are cached in memory for 1 hour
- Discord user lookups are cached for 10 minutes
- Avatar fetches are cached for 1 hour

## Frontend

The root route serves a lightweight browser UI that lets you:

- enter a Discord ID
- override the display name
- add optional attribution text
- choose a layout template
- enable monospace mode for equal-width glyph cells
- preview the generated PNG

## Cloudflare Deployment

The Worker entrypoint is `src/worker.ts` and static assets are served from `src/public` via the `ASSETS` binding defined in `wrangler.toml`.

Typical deployment flow:

1. Set `DISCORD_BOT_TOKEN` as a Cloudflare Worker secret.
2. Run `bun run cf:deploy`.
3. Ensure your route or custom domain matches `wrangler.toml`.

This repository also includes a GitHub Actions workflow that type-checks the project and triggers a Cloudflare deploy hook on pushes to `main`.

## Project Structure

```text
src/
  app.ts                API routes and runtime-agnostic app setup
  worker.ts             Cloudflare Worker entrypoint
  index.ts              Bun entrypoint
  generator.ts          Quote SVG layout and rendering logic
  discord.ts            Discord API and avatar helpers
  render-svg-native.ts  Native Bun PNG rendering
  render-svg-wasm.ts    WASM PNG rendering for Workers
  public/               Browser UI and Worker assets
```
