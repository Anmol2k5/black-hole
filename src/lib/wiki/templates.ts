/**
 * Wiki page templates for auto-generated pages.
 * Each template defines the structure and how to aggregate insights.
 */

export interface WikiPageTemplate {
  slug: string;
  title: string;
  category: string;
  description: string;
  insightKeys: string[]; // Which extraction insight arrays feed into this page
}

export const WIKI_TEMPLATES: WikiPageTemplate[] = [
  {
    slug: 'product/requested-features',
    title: 'Requested Features',
    category: 'product',
    description: 'Features requested by customers and stakeholders, ranked by frequency and urgency.',
    insightKeys: ['feature_requests'],
  },
  {
    slug: 'product/known-bugs',
    title: 'Known Bugs & Issues',
    category: 'product',
    description: 'Bugs and technical issues reported across sources.',
    insightKeys: ['bugs'],
  },
  {
    slug: 'product/roadmap-evidence',
    title: 'Roadmap Evidence',
    category: 'product',
    description: 'Evidence from customers and stakeholders that should inform the product roadmap.',
    insightKeys: ['feature_requests', 'pain_points', 'positive_feedback'],
  },
  {
    slug: 'product/onboarding-feedback',
    title: 'Onboarding Feedback',
    category: 'product',
    description: 'Feedback related to user onboarding, setup, and first-time experience.',
    insightKeys: ['pain_points', 'negative_feedback', 'positive_feedback'],
  },
  {
    slug: 'sales/pricing-objections',
    title: 'Pricing Objections',
    category: 'sales',
    description: 'Pricing-related objections and feedback from prospects and customers.',
    insightKeys: ['pricing_feedback', 'sales_objections'],
  },
  {
    slug: 'sales/lost-deal-reasons',
    title: 'Lost Deal Reasons',
    category: 'sales',
    description: 'Reasons deals were lost or stalled, based on sales conversations.',
    insightKeys: ['sales_objections', 'negative_feedback', 'competitor_mentions'],
  },
  {
    slug: 'sales/competitor-mentions',
    title: 'Competitor Mentions',
    category: 'sales',
    description: 'All mentions of competitors across customer conversations and internal discussions.',
    insightKeys: ['competitor_mentions'],
  },
  {
    slug: 'support/repeated-complaints',
    title: 'Repeated Complaints',
    category: 'support',
    description: 'Issues and complaints that appear across multiple sources.',
    insightKeys: ['pain_points', 'negative_feedback', 'bugs'],
  },
  {
    slug: 'strategy/customer-pain-points',
    title: 'Customer Pain Points',
    category: 'strategy',
    description: 'Aggregated customer pain points ranked by frequency and severity.',
    insightKeys: ['pain_points'],
  },
  {
    slug: 'strategy/open-questions',
    title: 'Open Questions',
    category: 'strategy',
    description: 'Unresolved questions and uncertainties from across all sources.',
    insightKeys: ['open_questions'],
  },
  {
    slug: 'synthesis/top-insights',
    title: 'Top Insights',
    category: 'synthesis',
    description: 'The most important insights compiled across all sources. Auto-updated as new data arrives.',
    insightKeys: ['pain_points', 'feature_requests', 'sales_objections', 'positive_feedback', 'negative_feedback'],
  },
];

/**
 * Generate Markdown content for a wiki page from aggregated insights.
 */
export function renderWikiPage(
  template: WikiPageTemplate,
  insights: Array<{ text: string; sourceQuote: string; sourceTitle: string; sourceDate: string; severity: string }>,
  sourceCount: number,
): string {
  const now = new Date().toISOString().split('T')[0];

  let md = `---\ntitle: "${template.title}"\ncategory: "${template.category}"\nsources: ${sourceCount}\nupdated: "${now}"\n---\n\n`;
  md += `# ${template.title}\n\n`;
  md += `> ${template.description}\n\n`;
  md += `**Sources:** ${sourceCount} | **Last updated:** ${now}\n\n---\n\n`;

  if (insights.length === 0) {
    md += `*No data yet. Upload sources to populate this page.*\n`;
    return md;
  }

  // Group by severity
  const critical = insights.filter(i => i.severity === 'critical');
  const high = insights.filter(i => i.severity === 'high');
  const medium = insights.filter(i => i.severity === 'medium');
  const low = insights.filter(i => i.severity === 'low');

  if (critical.length > 0) {
    md += `## 🔴 Critical\n\n`;
    md += renderInsightList(critical);
  }
  if (high.length > 0) {
    md += `## 🟠 High Priority\n\n`;
    md += renderInsightList(high);
  }
  if (medium.length > 0) {
    md += `## 🟡 Medium Priority\n\n`;
    md += renderInsightList(medium);
  }
  if (low.length > 0) {
    md += `## 🟢 Low Priority\n\n`;
    md += renderInsightList(low);
  }

  return md;
}

function renderInsightList(
  items: Array<{ text: string; sourceQuote: string; sourceTitle: string; sourceDate: string }>
): string {
  let md = '';
  for (const item of items) {
    md += `- **${item.text}**\n`;
    if (item.sourceQuote) {
      md += `  > "${item.sourceQuote}"\n`;
    }
    if (item.sourceTitle) {
      const dateStr = item.sourceDate ? ` (${item.sourceDate})` : '';
      md += `  — *${item.sourceTitle}${dateStr}*\n`;
    }
    md += `\n`;
  }
  return md;
}

/**
 * Generate the wiki index page.
 */
export function renderIndexPage(
  pages: Array<{ slug: string; title: string; category: string; sourceCount: number; updatedAt: string }>
): string {
  const now = new Date().toISOString().split('T')[0];

  let md = `---\ntitle: "Company Brain Wiki"\nupdated: "${now}"\n---\n\n`;
  md += `# 🧠 Company Brain Wiki\n\n`;
  md += `Your company's compiled knowledge base. Auto-generated from uploaded sources.\n\n`;
  md += `**Last updated:** ${now}\n\n---\n\n`;

  // Group by category
  const categories = new Map<string, typeof pages>();
  for (const page of pages) {
    if (!categories.has(page.category)) {
      categories.set(page.category, []);
    }
    categories.get(page.category)!.push(page);
  }

  const categoryEmoji: Record<string, string> = {
    product: '📦',
    sales: '💰',
    support: '🎧',
    strategy: '🎯',
    synthesis: '🔬',
    customers: '👥',
  };

  for (const [category, categoryPages] of categories) {
    const emoji = categoryEmoji[category] || '📄';
    md += `## ${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    for (const page of categoryPages) {
      md += `- [${page.title}](/wiki/${page.slug}) — ${page.sourceCount} sources — updated ${page.updatedAt}\n`;
    }
    md += `\n`;
  }

  return md;
}
