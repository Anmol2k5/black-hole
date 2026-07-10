/**
 * Wiki page definitions (Phase 11.2). Configuration-driven so pages are easy
 * to add or retune without touching the compiler.
 */

export interface WikiPageDefinition {
  slug: string;
  title: string;
  claimTypes: string[];
  sort: "uniqueSourceCount" | "mentionCount" | "confidence" | "weightedSeverity";
  minimumEvidence: number;
  category: string;
}

export const wikiPageDefinitions: WikiPageDefinition[] = [
  {
    slug: "product/requested-features",
    title: "Requested Features",
    claimTypes: ["feature_request"],
    sort: "uniqueSourceCount",
    minimumEvidence: 1,
    category: "product",
  },
  {
    slug: "sales/pricing-objections",
    title: "Pricing Objections",
    claimTypes: ["pricing_feedback", "sales_objection"],
    sort: "weightedSeverity",
    minimumEvidence: 1,
    category: "sales",
  },
  {
    slug: "support/pain-points",
    title: "Pain Points",
    claimTypes: ["pain_point", "bug"],
    sort: "uniqueSourceCount",
    minimumEvidence: 1,
    category: "support",
  },
  {
    slug: "customers/competitors",
    title: "Competitor Mentions",
    claimTypes: ["competitor_mention"],
    sort: "mentionCount",
    minimumEvidence: 1,
    category: "customers",
  },
  {
    slug: "product/positive-feedback",
    title: "Positive Feedback",
    claimTypes: ["positive_feedback"],
    sort: "uniqueSourceCount",
    minimumEvidence: 1,
    category: "product",
  },
];
