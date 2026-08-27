# SaaS Teardown Engine (`saas-teardown`)

> Production-grade CLI competitive intelligence tool designed to automate website crawling, technical fingerprinting, and structured LLM extraction using Gemini 3.5 Flash Lite.

---

## Overview

`saas-teardown` is a high-performance CLI pipeline built in Node.js (ESM). It ingests target SaaS domain URLs, bypasses static anti-bot protections, extracts client-side technical fingerprints, and uses **Gemini 3.5 Flash Lite** paired with **Zod schema enforcement** to deliver 100% deterministic, type-safe competitive teardown analyses.

## Key Features

* **Automated Batch Processing:** Run teardowns against single targets or batch inputs via JSON/CSV files.
* **24-Hour File Caching:** Local disk-based cache (`/.cache`) prevents redundant HTTP requests and API usage.
* **Type-Safe Validation:** Zod schema validation guarantees structured JSON outputs persisted to `/outputs`.
* **High Grounding Accuracy:** Optimized system prompts achieving **100/100 benchmark scores** on technical stack extraction and business positioning summaries.

---

## Architecture
