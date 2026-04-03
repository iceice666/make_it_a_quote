# API

Base path: `/api`

## POST `/generate`

Generates a quote image from a Discord user and quote text.

### Request body

```json
{
  "discordId": "123456789012345678",
  "content": "Small choices become big changes.",
  "displayName": "ice",
  "attributionSuffix": "in #general",
  "template": "left-half"
}
```

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `discordId` | string | Yes | 17-20 digit Discord user ID |
| `content` | string | Yes | Quote text, 1-500 chars |
| `displayName` | string | No | Override name, max 64 chars |
| `attributionSuffix` | string | No | Extra attribution text, max 80 chars |
| `template` | string | No | `left-half` or `top-half`; defaults to `left-half` |

### Success response

- Status: `200 OK`
- Content-Type: `image/png`
- Cache-Control: `public, max-age=3600, s-maxage=3600`

### Error responses

```json
{
  "error": "Failed to generate quote image",
  "detail": "..."
}
```

- `429 Too Many Requests`: rate limited, may include `Retry-After` header and `retryAfter` in the JSON body
- `500 Internal Server Error`: Discord lookup, avatar fetch, or render failure

### Example

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "content-type: application/json" \
  --output quote.png \
  -d '{
    "discordId": "123456789012345678",
    "content": "電爆所有人",
    "displayName": "Prof. Kohiro",
    "attributionSuffix": "沒說過",
    "template": "left-half"
  }'
```

## POST `/resolve`

Resolves a Discord user profile for previewing name and avatar.

### Request body

```json
{
  "discordId": "123456789012345678",
  "displayName": "ice"
}
```

### Success response

```json
{
  "id": "123456789012345678",
  "username": "yilin",
  "displayName": "guo10",
  "avatarUrl": "https://cdn.discordapp.com/..."
}
```

### Notes

- `discordId` must be 17-20 digits
- `displayName` is optional and capped at 64 chars
- Rate limited separately from `/generate`

## GET `/health`

Basic service health check.

### Success response

```json
{
  "ok": true,
  "runtime": "bun",
  "version": "0.1.0",
  "uptimeSeconds": 123,
  "timestamp": "2026-04-04T00:00:00.000Z"
}
```
