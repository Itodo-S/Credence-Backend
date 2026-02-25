# API Subscription Tiers and Quotas

The Credence Backend enforces rate limits and governs endpoint access via an API Key-based Subscription system.

## Tiers and Limits

### `FREE`
- **Rate Limit**: 10 requests per minute
- **Allowed Endpoints**: `/api/health`, `/api/trust`

### `PRO`
- **Rate Limit**: 100 requests per minute
- **Allowed Endpoints**: `/api/health`, `/api/trust`, `/api/bond`

### `ENTERPRISE`
- **Rate Limit**: 1000 requests per minute (by default, unlimited with Admin Override)
- **Allowed Endpoints**: All (`*`)

## Usage

To authenticate requests to protected endpoints, you must include the `x-api-key` header with a valid key.

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/trust/0x123...
```

### Rate Limiting Headers
Every authenticated response will include an `X-RateLimit-Remaining` header, indicating how many requests are remaining in the current 1-minute time window.

### Admin Overrides
Keys can be generated with `isAdminOverride = true` (common for Enterprise/internal scenarios) which bypasses quote decrementing completely, ensuring high-availability internal routing doesn't get throttled.

## Error Codes
- **401 Unauthorized**: The `x-api-key` header was not present.
- **403 Forbidden**: Found when the key is invalid, inactive, expired, or trying to access an endpoint restricted by its associated Tier.
- **429 Too Many Requests**: The rate limit has been exhausted for the time window.
