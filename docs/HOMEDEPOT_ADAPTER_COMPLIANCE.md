**Home Depot Adapter — Terms of Use Summary & Compliance Checklist**

Purpose
-------
This document extracts the parts of The Home Depot Terms of Use most relevant to running the Home Depot adapter in this repository, and gives a concise, developer-focused checklist and required mitigations.

Executive summary
-----------------
- The Home Depot’s Terms grant only limited rights: viewing and printing pages for personal, non-commercial use. Reproducing, copying, scraping, or using site content for resale or commercial redistribution is expressly restricted.
- The Terms and the site’s `robots.txt` both restrict automated access. The repo must NOT enable scraping in shared, staging, or production environments without explicit permission.
- Trademarks and logos are protected; do not use The Home Depot brand or logo in your UI or marketing without written permission.
- If you receive a DMCA/rights request, follow takedown procedures immediately (contact info below).

Key TOS clauses (developer highlights)
-------------------------------------
- Copyrights / Use License: viewing/printing for personal, non-commercial use only; no copying, distribution, derivative works, or resale.
- Prohibited conduct: impersonation, fraud, imposing an unreasonable load on infrastructure, and reseller activities (explicitly includes extracting/scraping/mining/copying for resale).
- Product orders: The Home Depot may limit quantities, correct pricing errors, and refuse transactions — do not automate order placement.
- Trademarks: no use of The Home Depot marks without prior written consent; linking with logos requires permission.
- DMCA: contact IP_Requests@homedepot.com (see Contact & DMCA below).

Concrete implications for this project
------------------------------------
- Never enable `unofficial` scraping on shared or public infrastructure without a legal review and explicit written permission from The Home Depot.
- Treat `HOMEDPOT_MODE=mock` as the safe default for development and CI.
- Require developer opt-in for `unofficial` with both `ALLOW_UNOFFICIAL=true` and `NODE_ENV=development` (or a machine-local guard). The repo already adds `ALLOW_UNOFFICIAL` in `.env.example`.
- Enforce `robots.txt` checks before every outbound request (implemented via `server/src/utils/robotsChecker.ts`). If a path is disallowed, do not fetch it and fall back to provider/mock data.
- Rate-limit, cache, and back off: avoid repeated or heavy scraping. Use the existing `RateLimiter` and `simpleCache`, and set conservative TTLs.
- Do not use The Home Depot trademarked assets (logo, brand name used as logo) in the UI. If you must show product names, avoid branded UI elements that imply endorsement.

Developer checklist (must-haves before enabling unofficial mode locally)
-------------------------------------------------------------------------
- Environment gating: `ALLOW_UNOFFICIAL=true` and `NODE_ENV=development` (or an equivalent local-only guard).
- Robots enforcement: call `isAllowedUrl(url)` from `server/src/utils/robotsChecker.ts` before making any adapter request. The adapter already calls this for key endpoints.
- User-Agent: use a clearly identified User-Agent string that includes the app name and a contact email/URL.
- Rate limiting: ensure per-adapter token buckets are configured (`HOMEDPOT_RATE_LIMIT_PER_MIN`) and enforce server-side throttling on inbound routes.
- Caching: set TTLs for product and search responses; use Redis for shared environments to avoid repeated requests.
- Audit logging: record the URL, timestamp, mode (mock|unofficial), and result (fetched|skipped-by-robots) for every external call.
- Admin protection: protect revoke/admin endpoints with authentication before any shared deployment.

Operational & legal safeguards (recommended)
-------------------------------------------
- Add a debug admin endpoint that returns robots decision for a given URL (helpful for debugging and audits).
- Add automated tests that assert `robotsChecker.isAllowedUrl()` blocks disallowed paths used by the adapter.
- Prepare a DMCA response playbook: on takedown, remove data, preserve logs, and notify legal.
- Keep all `unofficial` logic clearly labeled in code and docs; include a header comment in `server/src/adapters/homedepotAdapter.ts` describing the mode and the legal risk.

What to do if The Home Depot objects / sends a takedown
------------------------------------------------------
1. Immediately disable the offending adapter or URL path in your environment (flip to `mock` or `live` partner mode).
2. Remove any stored copies of content identified in the takedown request.
3. Preserve logs for the requested timeframe and forward the takedown to your legal contact.
4. Contact The Home Depot DMCA address: IP_Requests@homedepot.com (or use the physical address in their Terms) and follow legal guidance.

Contact & DMCA
--------------
The Home Depot DMCA/rights contact shown in the Terms of Use:

- Email: IP_Requests@homedepot.com
- Mail: Designated DMCA Agent, 2455 Paces Ferry Road Building C-20, Atlanta, GA 30339-4024

Relevant code pointers
----------------------
- Adapter: [server/src/adapters/homedepotAdapter.ts](server/src/adapters/homedepotAdapter.ts)
- Robots checker: [server/src/utils/robotsChecker.ts](server/src/utils/robotsChecker.ts)
- Cache: [server/src/utils/simpleCache.ts](server/src/utils/simpleCache.ts)
- Rate limiter: [server/src/utils/rateLimiter.ts](server/src/utils/rateLimiter.ts)
- Env toggles: [.env.example](.env.example)

Next recommended actions (I can implement these for you)
-------------------------------------------------------
- Add an admin robots-check route that returns the parsed rules and the adapter's decision for a URL.
- Harden the revoke/admin endpoints with a simple API key guard for now.
- Add an automated test that fails if the adapter attempts to fetch a robots-disallowed URL.

Summary
-------
This repo already follows many good practices (mock default, rate limits, caching). The immediate gaps were robots enforcement and the need for an explicit, local-only opt-in for `unofficial` scrapers — both have been addressed in code and `.env.example`. Follow the checklist above before enabling scraping on any shared system.
