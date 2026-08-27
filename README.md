# SaaS Teardown Engine (`saas-teardown`)

> Production-grade CLI competitive intelligence tool designed to automate website crawling, technical fingerprinting, and structured LLM extraction using **Gemini 3.5 Flash Lite**.

---

## Overview

`saas-teardown` is a high-performance CLI pipeline built with **Node.js (ESM)**.

It ingests target SaaS domain URLs, bypasses static anti-bot protections, extracts client-side technical fingerprints, and uses **Gemini 3.5 Flash Lite** with schema enforcement to produce structured competitive teardown analyses.

The pipeline is designed around **grounded extraction**: the LLM is instructed to transform collected crawl evidence rather than independently research, speculate, or invent information.

---

## Key Features

* **Automated Batch Processing** — Run teardowns against individual targets or batches using JSON/CSV input files.
* **24-Hour File Caching** — Local disk-based caching in `/.cache` prevents redundant HTTP requests and unnecessary API usage.
* **Technical Fingerprinting** — Detect client-side technologies from crawled websites.
* **Structured LLM Analysis** — Transform crawl evidence into structured competitive intelligence reports.
* **Schema Validation** — Enforce consistent JSON output before reports are persisted.
* **Evidence Grounding** — Observed facts are required to reference evidence collected from the target website.
* **Technology Isolation** — The analyzer is restricted to technologies detected by the crawler rather than allowing the model to invent a technical stack.
* **Benchmarking** — Compare model performance using schema validity, evidence grounding, technology matching, latency, and overall scores.
* **Model Configurability** — Select the Gemini model through the `GEMINI_MODEL` environment variable.

---

## Architecture

```text
                  +-------------------+
                  |   Commander CLI   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |   Cache Check     |<---> [ /.cache ]
                  +---------+---------+
                            |
                     (Cache Miss)
                            |
                            v
                  +-------------------+
                  |  Crawler Engine   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |   Fingerprinter   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |  Gemini Analyzer  |
                  | (Schema Validated)|
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  | File Persistence  |
                  +---------+---------+
                            |
                            v
                       [ /outputs ]
```

---

## Analysis Pipeline

The teardown process follows a staged pipeline:

### 1. Target Discovery

The CLI receives a SaaS website URL either individually or through a batch input file.

### 2. Cache Check

Before making network requests, the engine checks the local `/.cache` directory.

Cached results are reused for up to **24 hours**, reducing:

* HTTP requests
* Crawl time
* API usage
* Repeated analysis costs

### 3. Website Crawling

The crawler collects relevant website information, including:

* Page title
* Headings
* Body text
* Pricing links
* Other crawl evidence

### 4. Technical Fingerprinting

The fingerprinting stage identifies technologies observed on the target website.

These detected technologies are passed directly to the analysis stage.

### 5. Gemini Analysis

The collected evidence is sent to Gemini for structured transformation.

The analyzer is explicitly instructed to:

* Avoid external research
* Avoid speculation
* Avoid inventing facts
* Preserve evidence
* Only report detected technologies
* Separate observations from analytical insights

### 6. Structured Output

The model produces a structured JSON report containing:

* Company name
* Value proposition
* Observed facts
* Pricing plans
* Detected technologies
* Analytical insights

### 7. Persistence

Validated results are stored in the `/outputs` directory for later inspection and benchmarking.

---

# Benchmarking

The project includes a benchmark suite for evaluating the quality and performance of the LLM analysis stage.

The benchmark currently evaluates six target SaaS websites:

```text
Cal
Linear
PostHog
Notion
Vercel
LocalCan
```

## Benchmark Metrics

Each generated report is evaluated across three primary dimensions.

### Schema Validity

Checks whether the generated report contains the required output structure and expected array fields.

### Evidence Grounding

Checks whether evidence supplied by the model can be matched against the crawl evidence.

For example:

```text
3/3 matched facts
```

means that all three reported observed facts contained evidence that matched the collected website text.

### Technology Match

Checks whether technologies reported by the model correspond to technologies actually detected by the crawler.

This helps identify technical hallucinations.

---

## Weighted Benchmark Score

The overall benchmark score is calculated using:

| Metric             |   Weight |
| ------------------ | -------: |
| Schema Validity    |      30% |
| Evidence Grounding |      30% |
| Technology Match   |      30% |
| Baseline           |      10% |
| **Total**          | **100%** |

The benchmark also records:

* Per-site latency
* Average latency
* Per-site score
* Average score
* Number of reported technologies
* Grounding matches
* Technology matches

---

# Model A/B Benchmarking

The analyzer supports selecting the Gemini model through `.env`.

For example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

You can switch the model without changing the analyzer source code:

```env
GEMINI_MODEL=gemini-3.1-flash-lite
```

This makes it possible to perform controlled **3.1 vs 3.5 A/B benchmarks** using the same crawler evidence and evaluation methodology.

### Example

Run the benchmark with:

```env
GEMINI_MODEL=gemini-3.1-flash-lite
```

Record:

```text
Average Latency
Macro Average Score
Grounding %
Technology Match %
```

Then switch to:

```env
GEMINI_MODEL=gemini-3.5-flash-lite
```

and run the same benchmark again.

This allows the two models to be compared using the same six target websites.

---

# Quick Start

## Prerequisites

* **Node.js v18+**
* A **Gemini API key**

Get a Gemini API key from:

[Google AI Studio](https://aistudio.google.com/?utm_source=chatgpt.com)

---

## Installation

```bash
git clone https://github.com/Boitumelo2006/saas-teardown.git

cd saas-teardown

npm install
```

---

## Environment Configuration

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Note:** Keep `.env` out of version control. Never commit your Gemini API key to GitHub.

---

# CLI Usage

## Analyze a Single Target

```bash
node src/index.js analyze --url https://stripe.com
```

---

## Run Batch Teardown Pipeline

```bash
node src/index.js batch --input targets.json
```

---

# Running the Benchmark

After the required raw crawl outputs have been generated, run:

```bash
node scripts/benchmark.js
```

The benchmark will analyze the configured target sites and produce a summary similar to:

```text
=============================================================================
📊 BENCHMARK SUMMARY TABLE
=============================================================================

Site       Latency (ms)   Score (/100)   Schema %   Grounding %   Tech Match %
Cal        2548           100            100%       100%          100%
Linear     1740           100            100%       100%          100%
Posthog    2499           100            100%       100%          100%
Notion     1985           100            100%       100%          100%
Vercel     1667           100            100%       100%          100%
Localcan   2345           100            100%       100%          100%

📈 Aggregate Performance Overview:

• Model:                   gemini-3.5-flash-lite
• Total Sites Evaluated:  6 / 6
• Average Latency:        2131 ms
• Macro Average Score:    100.0 / 100
```

---

# Project Structure

```text
saas-teardown/
│
├── src/
│   ├── analyzer.js
│   ├── index.js
│   └── ...
│
├── scripts/
│   └── benchmark.js
│
├── outputs/
│   └── ...raw.json
│
├── .cache/
│   └── ...
│
├── targets.json
├── package.json
├── .env
└── README.md
```

---

# Design Philosophy

The core philosophy of `saas-teardown` is:

> **Collect evidence first. Analyze second.**

The LLM is not treated as the source of truth.

Instead, the crawler and fingerprinting layers establish the evidence boundary, while Gemini transforms that evidence into a structured competitive intelligence report.

This approach is intended to reduce:

* Hallucinated technologies
* Unsupported business claims
* Fabricated pricing information
* Non-verifiable observations
* Inconsistent report structures

---

# Current Benchmark

The current benchmark suite evaluates:

**6 / 6 target websites**

The benchmark is designed to make model changes measurable rather than relying purely on subjective output quality.

Example metrics:

```text
Schema Validity
Evidence Grounding
Technology Match
Latency
Overall Score
```

This makes it possible to test cheaper or faster Gemini models while monitoring whether analytical quality deteriorates.

---

# License

This project is licensed under the **MIT License**.
