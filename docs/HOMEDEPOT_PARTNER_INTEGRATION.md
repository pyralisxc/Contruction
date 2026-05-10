Home Depot Partner Integration — Checklist & Recommendations
===========================================================

Purpose
-------
This document describes recommended steps, auth patterns, and engineering considerations when moving from experimental scraping to an official partner integration with a retailer such as The Home Depot.

High-level steps
----------------
1. Contact the partner and request developer/API access, terms, and rate-limit guidance.
2. Request or negotiate: API contract (endpoints, data schema), SLA, allowed usage, and commercial terms for access.
3. Obtain credentials and environment details (API key, OAuth client, rate limits, sandbox endpoints).
4. Implement a `live` adapter that authenticates to the partner API and maps partner fields to `NormalizedOffer`.
5. Replace any `unofficial` scraping code with the `live` adapter and add integration tests against the partner sandbox.

Authentication patterns
-----------------------
- Server-to-server: API keys or OAuth 2.0 client credentials grant. Keep secrets server-side only and rotate keys periodically.
- End-user flows: Use PKCE/OAuth if the partner requires user consent. Do not embed secrets in client bundles.
- Short-lived tokens: prefer short TTLs + refresh token rotation for long sessions.

Design & mapping guidance
------------------------
- Map partner product data into your `NormalizedOffer` shape. Required fields: `sku`, `title`, `price`, `currency`, `unit`, `packSize`, `quantityAvailable`, `inStock`, `productUrl`, `imageUrl`, `lastUpdated`.
- Preserve vendor IDs (partner product ID, store id) in `meta` for reconciliation and audits.
- Respect partner rate limits; implement token buckets and exponential backoff on 429/5xx responses.
- Cache responses (product details and search results) with sensible TTLs (minutes for inventory, hours for product metadata) and use Redis for distributed caches.

Operational considerations
------------------------
- Idempotency: For write operations (orders/reservations) use idempotency keys when the partner supports them.
- Correlation IDs: add a request-id header and log correlation IDs for every external call.
- Logging: avoid storing PII from partner responses; redact sensitive values in logs.
- Monitoring: track p50/p95 latency for partner calls, error rates, and rate-limit events.

Testing & sandbox
-----------------
- Always use partner sandbox/staging endpoints for integration tests.
- Add contract tests that assert the partner response shape and key fields exist.
- Add smoke tests to run in CI that validate authentication and a small sample query.

Security & compliance
---------------------
- Store secrets in environment variables or secrets manager, never in the repo.
- Use TLS for all requests; validate partner certificates.
- Follow partner's branding/trademark rules — do not use logos without permission.

Example implementation notes
----------------------------
- Create `server/src/adapters/homedepotLiveAdapter.ts` that implements `StoreAdapter` and uses the partner credentials.
- Implement a feature-flag: `HOMEDPOT_MODE=live` and require `HOMEDPOT_API_KEY` (or OAuth client credentials) to be present.
- Add CI secrets for sandbox credentials and run a lightweight integration test during CI to validate connectivity.
