Experimental / Unofficial scrapers
================================

This folder is intended to hold experimental or unofficial scraping code that should never be deployed to shared, staging, or production infrastructure.

Guidance
--------
- Keep code here small and gated behind local-only flags (`ALLOW_UNOFFICIAL=true` + `NODE_ENV=development`).
- Do not reference this folder from production build pipelines.
- Prefer moving finalized partner adapters to `server/src/adapters/` under a `live` mode with proper credentials, authentication, and legal review.

If legal counsel asks for the code to be removed, follow the repository remediation steps in `docs/HOMEDEPOT_ADAPTER_COMPLIANCE.md`.
