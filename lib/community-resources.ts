import type { Resource } from './resources'

// ──────────────────────────────────────────────────────────────────────────
// Community resource explorer — resident-facing catalog (for regular people,
// not businesses). Mirrors lib/resources.ts in shape so the same ResourceCard /
// ResourceGrid / ResourceChat components render it, but the content + chat are
// kept entirely separate from the small-business hub the vendor portal uses.
//
// Same rule as the business catalog: never ship a fabricated link. Where a real
// verified URL isn't known, leave `url: null` + `searchHint` and the UI shows a
// "Find this program →" web search instead.
// ──────────────────────────────────────────────────────────────────────────

export const COMMUNITY_RESOURCES: Resource[] = [
  {
    id: 'sf-211',
    title: '211 — Help starts here',
    org: 'United Way Bay Area',
    category: 'community',
    summary: 'One call/text connects you to food, housing, health, and more.',
    description:
      'Free, confidential, 24/7 referral line that connects Bay Area residents to thousands of local services — food, housing, healthcare, financial help, and crisis support. Available by phone (dial 211) and online in many languages.',
    cost: 'free',
    url: null,
    searchHint: '211 Bay Area United Way help line',
    city: 'sf',
    tags: ['referral', 'hotline', 'food', 'housing', 'health', 'crisis', '211'],
    recommendFor: { always: true },
  },
  {
    id: 'sf-calfresh',
    title: 'CalFresh (food benefits)',
    org: 'SF Human Services Agency',
    category: 'food',
    summary: 'Monthly grocery money for people with low income.',
    description:
      'CalFresh (food stamps / SNAP) puts money on a card each month to buy groceries. Many working individuals and families qualify. The city and local nonprofits help you apply for free.',
    cost: 'free',
    url: null,
    searchHint: 'CalFresh San Francisco apply food benefits',
    city: 'sf',
    tags: ['food', 'groceries', 'snap', 'benefits', 'calfresh', 'ebt'],
    recommendFor: { keywords: ['food', 'grocery', 'hungry', 'meals'] },
  },
  {
    id: 'sf-food-bank',
    title: 'SF-Marin Food Bank',
    org: 'SF-Marin Food Bank',
    category: 'food',
    summary: 'Free groceries at neighborhood pantries across the city.',
    description:
      'Find a free food pantry near you. Weekly groceries — produce, staples, and more — with no cost and minimal paperwork. Locations in most neighborhoods, plus home delivery for some seniors and people with disabilities.',
    cost: 'free',
    url: null,
    searchHint: 'SF-Marin Food Bank pantry locator',
    city: 'sf',
    tags: ['food', 'pantry', 'groceries', 'free', 'produce'],
    recommendFor: { keywords: ['food', 'grocery', 'hungry', 'meals', 'pantry'] },
  },
  {
    id: 'sf-rent-help',
    title: 'Emergency rental assistance',
    org: 'SF / community partners',
    category: 'housing',
    summary: 'Help paying back rent and avoiding eviction.',
    description:
      'Financial help for renters who fell behind or face eviction, plus connections to longer-term housing support. Local nonprofits walk you through eligibility and the application.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco emergency rental assistance eviction help',
    city: 'sf',
    tags: ['housing', 'rent', 'eviction', 'assistance', 'back rent'],
    recommendFor: { keywords: ['rent', 'evict', 'housing', 'landlord'] },
  },
  {
    id: 'sf-tenant-rights',
    title: 'Tenant rights & counseling',
    org: 'SF Tenants Union / housing clinics',
    category: 'housing',
    summary: 'Know your rights as a renter; free counseling.',
    description:
      'Free, confidential counseling on rent increases, repairs, evictions, and harassment. Get help understanding your lease and your rights under SF rent rules before you sign or respond to a notice.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco tenant rights counseling tenants union',
    city: 'sf',
    tags: ['housing', 'tenant', 'rights', 'eviction', 'lease', 'counseling'],
    recommendFor: { keywords: ['tenant', 'rent', 'evict', 'landlord', 'lease'] },
  },
  {
    id: 'sf-healthy-sf',
    title: 'Healthy San Francisco / clinics',
    org: 'SF Department of Public Health',
    category: 'health',
    summary: 'Low- and no-cost healthcare for uninsured residents.',
    description:
      'Health access for uninsured San Franciscans, plus a network of community clinics offering primary care, dental, and specialty services on a sliding scale. Help enrolling in Medi-Cal and other coverage too.',
    cost: 'low-cost',
    url: null,
    searchHint: 'Healthy San Francisco enroll community clinics',
    city: 'sf',
    tags: ['health', 'clinic', 'uninsured', 'medi-cal', 'doctor', 'dental'],
    recommendFor: { keywords: ['health', 'doctor', 'clinic', 'insurance', 'sick'] },
  },
  {
    id: 'sf-mental-health',
    title: 'Mental health & crisis support',
    org: 'SF DPH / 988',
    category: 'mental-health',
    summary: 'Free counseling and 24/7 crisis lines.',
    description:
      'Connections to counseling, therapy, and substance-use support on a sliding scale, plus the 988 Suicide & Crisis Lifeline (call or text 988) for immediate, free, confidential help any time.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco mental health services 988 crisis line',
    city: 'sf',
    tags: ['mental health', 'counseling', 'therapy', 'crisis', '988', 'depression'],
    recommendFor: { keywords: ['stress', 'anxiety', 'depress', 'crisis', 'counseling', 'therapy'] },
  },
  {
    id: 'sf-legal-aid',
    title: 'Free legal aid',
    org: 'Bay Area Legal Aid',
    category: 'legal-aid',
    summary: 'Free civil legal help — housing, benefits, safety.',
    description:
      'Free legal assistance for low-income residents on civil matters: evictions, public benefits, domestic violence and safety, and consumer issues. Phone intake and neighborhood clinics.',
    cost: 'free',
    url: null,
    searchHint: 'Bay Area Legal Aid San Francisco free legal help',
    city: 'sf',
    tags: ['legal', 'aid', 'housing', 'benefits', 'safety', 'free lawyer'],
    recommendFor: { keywords: ['legal', 'lawyer', 'court', 'evict', 'benefits'] },
  },
  {
    id: 'sf-utility-help',
    title: 'Utility & energy bill help',
    org: 'PG&E CARE / community partners',
    category: 'financial-help',
    summary: 'Discounts and help paying gas & electric bills.',
    description:
      'Programs that lower your monthly gas and electric bill (like CARE/FERA discounts) and one-time help if you’ve fallen behind. Nonprofits help you enroll and apply for emergency assistance.',
    cost: 'free',
    url: null,
    searchHint: 'PG&E CARE discount San Francisco utility bill assistance',
    city: 'sf',
    tags: ['utility', 'pge', 'bill', 'energy', 'discount', 'financial', 'assistance'],
    recommendFor: { keywords: ['bill', 'utility', 'electric', 'gas', 'pge', 'money'] },
  },
  {
    id: 'sf-family-resource',
    title: 'Family resource centers',
    org: 'SF Family Resource Centers',
    category: 'family',
    summary: 'Childcare help, parenting support, family services.',
    description:
      'Neighborhood centers for families with young children: help finding and paying for childcare, parenting classes, playgroups, and connections to food, housing, and health services — all free.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco family resource center childcare subsidy',
    city: 'sf',
    tags: ['family', 'childcare', 'kids', 'parenting', 'subsidy', 'children'],
    recommendFor: { keywords: ['child', 'kid', 'family', 'daycare', 'parent', 'baby'] },
  },
  {
    id: 'sf-jobs-training',
    title: 'Job centers & free training',
    org: 'SF Office of Economic & Workforce Development',
    category: 'jobs',
    summary: 'Free job search help, training, and ESL classes.',
    description:
      'Neighborhood Access Points offer free help with resumes, job search, and placement, plus free skills training and English (ESL) and adult-education classes to move into better-paying work.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco access point job training OEWD ESL',
    city: 'sf',
    tags: ['jobs', 'training', 'employment', 'resume', 'esl', 'adult education'],
    recommendFor: { keywords: ['job', 'work', 'resume', 'training', 'english', 'class'] },
  },
  {
    id: 'sf-immigration',
    title: 'Immigration & citizenship help',
    org: 'SF Office of Civic Engagement & Immigrant Affairs',
    category: 'immigration',
    summary: 'Free, trusted immigration legal services.',
    description:
      'Free and low-cost help with citizenship applications, green cards, DACA, and know-your-rights — through trusted, city-funded nonprofits. Services in many languages and confidential.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco immigrant affairs OCEIA free legal services citizenship',
    city: 'sf',
    tags: ['immigration', 'citizenship', 'green card', 'daca', 'legal', 'rights'],
    recommendFor: { keywords: ['immigr', 'citizen', 'green card', 'daca', 'visa'] },
  },
  {
    id: 'sf-seniors',
    title: 'Senior & disability services',
    org: 'SF Department of Disability & Aging Services',
    category: 'seniors',
    summary: 'Meals, in-home care, benefits for older adults.',
    description:
      'Support for older adults and people with disabilities: home-delivered and community meals, in-home care, benefits enrollment, transportation, and friendly check-ins. Help for family caregivers too.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco Disability and Aging Services senior meals in-home care',
    city: 'sf',
    tags: ['seniors', 'disability', 'meals', 'caregiver', 'aging', 'in-home'],
    recommendFor: { keywords: ['senior', 'elder', 'disab', 'caregiver', 'aging'] },
  },
  {
    id: 'sf-library-community',
    title: 'SF Public Library',
    org: 'San Francisco Public Library',
    category: 'community',
    summary: 'Free books, internet, classes, and a warm place to be.',
    description:
      'More than books: free computer and internet access, classes and workshops, kids and teen programs, job and citizenship help, and welcoming spaces in every neighborhood. A library card is free for residents.',
    cost: 'free',
    url: null,
    searchHint: 'San Francisco Public Library card programs events',
    city: 'sf',
    tags: ['library', 'books', 'internet', 'classes', 'kids', 'community', 'free'],
    recommendFor: { always: true },
  },
]

const BY_ID: Record<string, Resource> = Object.fromEntries(
  COMMUNITY_RESOURCES.map((r) => [r.id, r])
)

export function getCommunityResource(id: string): Resource | undefined {
  return BY_ID[id]
}

/** Compact catalog rendering for the chat system prompt (grounds the model). */
export function communityResourcesForPrompt(): string {
  return COMMUNITY_RESOURCES.map((r) => {
    const link = r.url ?? `(no direct link — search: ${r.searchHint ?? r.title})`
    return `- [${r.id}] ${r.title} — ${r.org} (${r.category}). ${r.summary} ${link}`
  }).join('\n')
}
