export const FINGERPRINTS = [
  {
    name: 'Next.js',
    category: 'Frontend Framework',
    rules: {
      network: ['_next/static', '_next/image'],
      scripts: ['_next/static']
    }
  },
  {
    name: 'Vercel',
    category: 'Hosting & Infrastructure',
    rules: {
      headers: { server: 'vercel' },
      network: ['vercel-insights.com', 'va.vercel-scripts.com']
    }
  },
  {
    name: 'PostHog',
    category: 'Analytics',
    rules: {
      network: ['posthog.com/static', 'posthog.com/array'],
      scripts: ['posthog.com']
    }
  },
  {
    name: 'Cloudflare',
    category: 'Infrastructure',
    rules: {
      headers: { server: 'cloudflare' },
      network: ['challenges.cloudflare.com']
    }
  },
  {
    name: 'Stripe',
    category: 'Payments',
    rules: {
      scripts: ['js.stripe.com/v3'],
      network: ['api.stripe.com', 'checkout.stripe.com']
    }
  },
  {
    name: 'Intercom',
    category: 'Customer Support',
    rules: {
      scripts: ['widget.intercom.io'],
      network: ['api-iam.intercom.io']
    }
  }
];

export function matchFingerprints(rawEvidence) {
  const detected = [];

  for (const fp of FINGERPRINTS) {
    let score = 0;
    const evidenceItems = [];
    const sourceTypes = new Set();

    // Headers check (Weight: 2)
    if (fp.rules.headers) {
      for (const [header, val] of Object.entries(fp.rules.headers)) {
        const actualVal = rawEvidence.responseHeaders?.[header.toLowerCase()];
        if (actualVal && actualVal.toLowerCase().includes(val.toLowerCase())) {
          score += 2;
          sourceTypes.add('header');
          evidenceItems.push({ type: 'response_header', value: `${header}: ${actualVal}` });
        }
      }
    }

    // Network request patterns check (Weight: 1)
    if (fp.rules.network && Array.isArray(rawEvidence.networkRequests)) {
      for (const pattern of fp.rules.network) {
        const match = rawEvidence.networkRequests.find((req) => req.includes(pattern));
        if (match) {
          score += 1;
          sourceTypes.add('network');
          evidenceItems.push({ type: 'network_request', value: match });
        }
      }
    }

    // Inline/External Script tag patterns check (Weight: 1)
    if (fp.rules.scripts && Array.isArray(rawEvidence.scripts)) {
      for (const pattern of fp.rules.scripts) {
        const match = rawEvidence.scripts.find((src) => src.includes(pattern));
        if (match) {
          score += 1;
          sourceTypes.add('script');
          evidenceItems.push({ type: 'script_tag', value: match });
        }
      }
    }

    if (score > 0) {
      let confidence = 'low';
      if (score >= 3 || sourceTypes.size > 1) {
        confidence = 'high';
      } else if (score === 2) {
        confidence = 'medium';
      }

      detected.push({
        technology: fp.name,
        category: fp.category,
        confidence,
        evidence_score: score,
        evidence_sources: Array.from(sourceTypes),
        evidence: evidenceItems
      });
    }
  }

  return detected;
}