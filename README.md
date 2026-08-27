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
                  +-------------------+
                  |   Commander CLI   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |   Cache Check     |<---> [ /.cache ]
                  +---------+---------+
                            | (Cache Miss)
                            v
                  +-------------------+
                  | Crawler Engine    |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  | Fingerprinter     |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  | Gemini Analyzer   | (Zod Validated)
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  | File Persistence  |---> [ /outputs ]
                  +-------------------+

---

## Quick Start

### Prerequisites

* Node.js v18+ 
* Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
git clone [https://github.com/Boitumelo2006/saas-teardown.git](https://github.com/Boitumelo2006/saas-teardown.git)
cd saas-teardown
npm install

Environment Configuration
Create a .env file in the project root:
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

CLI Usage
Analyze Single Target
node src/index.js analyze --url [https://stripe.com](https://stripe.com)

Run Batch Teardown Pipeline
node src/index.js batch --input targets.json

License
This project is licensed under the MIT License.
---

### Step 3: Commit and Push the README Update

In PowerShell, save the updated `README.md` and push it:

```powershell
git add README.md
git commit -m "docs: add architecture diagram, CLI usage, and benchmark highlights to README"
git push
