#!/usr/bin/env bun
/**
 * Seed script for CLI integration tests.
 * Generates a large, reproducible dataset covering all CLI query scenarios.
 *
 * Usage:
 *   bun run apps/cli/scripts/seed-test-data.ts [db-path]
 *
 * If db-path is omitted, it writes to /tmp/reflecta-test.db
 */

import { Database } from "bun:sqlite";
import { createDBInstance } from "@reflecta/server";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.argv[2] ?? "/tmp/reflecta-test.db";

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const isNewDb = !fs.existsSync(dbPath);

console.log(`Opening database at: ${dbPath}`);

if (isNewDb) {
  const packageJson = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };
  const migratedDb = await createDBInstance(dbPath, {
    appVersion: packageJson.version,
    runMigrations: true,
  });
  migratedDb.$client.close();
  console.log(`Applied migrations through v${packageJson.version}`);
}

const db = new Database(dbPath);

if (!isNewDb) {
  console.log("Database exists. Truncating tables before seeding...");
  try {
    db.exec(`
      DELETE FROM understanding_domains;
      DELETE FROM understanding_connections;
      DELETE FROM contexts;
      DELETE FROM understandings;
      DELETE FROM domains;
    `);
  } catch {
    // Tables may not exist yet
  }
  console.log("Tables truncated.");
}

// ---------------------------------------------------------------------------
// Seeded PRNG for reproducibility
// ---------------------------------------------------------------------------

class SeededRng {
  private s: number;
  constructor(seed = 42) {
    this.s = seed;
  }
  next(): number {
    this.s = (this.s * 16807 + 0) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  pickUnique<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => this.next() - 0.5);
    return shuffled.slice(0, Math.min(count, arr.length));
  }
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}

const rng = new SeededRng(42);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(daysAgo = 0, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursOffset);
  return d.toISOString();
}

function generateId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36).slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Content generators
// ---------------------------------------------------------------------------

const UNDERSTANDING_PREFIXES = [
  "Concept",
  "Experiment",
  "Draft",
  "Sketch",
  "Plan",
  "Proposal",
  "Hypothesis",
  "Question",
  "Exploration",
  "Prototype",
  "Spike",
  "Investigation",
  "Understanding Experiment",
  "Design Doc",
  "RFC",
  "ADR",
  "Brainstorm",
  "Outline",
  "Realization",
  "Principle",
  "Pattern",
  "Lesson",
  "Truth",
  "Observation",
  "Conclusion",
  "Thesis",
  "Axiom",
  "Law",
  "Heuristic",
  "Maxim",
  "Paradox",
  "Discovery",
  "Breakthrough",
  "Synthesis",
  "Analysis",
  "Reflection",
  "Epiphany",
];

const SUBJECTS = [
  "React",
  "Vue",
  "Angular",
  "Svelte",
  "SolidJS",
  "Next.js",
  "Nuxt",
  "Astro",
  "TypeScript",
  "JavaScript",
  "Rust",
  "Go",
  "Python",
  "Zig",
  "Elixir",
  "CSS",
  "Tailwind",
  "Styled Components",
  "CSS Modules",
  "PostCSS",
  "Node.js",
  "Deno",
  "Bun",
  "Express",
  "Fastify",
  "Hono",
  "Axum",
  "PostgreSQL",
  "SQLite",
  "MySQL",
  "MongoDB",
  "Redis",
  "DuckDB",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Ansible",
  "Pulumi",
  "Nomad",
  "AWS",
  "GCP",
  "Azure",
  "Cloudflare",
  "Vercel",
  "Netlify",
  "Fly.io",
  "GraphQL",
  "REST",
  "gRPC",
  "tRPC",
  "WebSocket",
  "WebRTC",
  "Server-Sent Events",
  "LLM",
  "Transformer",
  "Diffusion Model",
  "RAG",
  "Vector Search",
  "Embeddings",
  "Observability",
  "Monitoring",
  "Logging",
  "Tracing",
  "Metrics",
  "Alerting",
  "Testing",
  "TDD",
  "Property Testing",
  "Fuzzing",
  "E2E",
  "Integration Testing",
  "Security",
  "OAuth",
  "OIDC",
  "JWT",
  "mTLS",
  "Zero Trust",
  "Rate Limiting",
  "Performance",
  "Caching",
  "CDN",
  "Edge Computing",
  "Lazy Loading",
  "Code Splitting",
  "Microservices",
  "Monolith",
  "Serverless",
  "CQRS",
  "Event Sourcing",
  "Saga Pattern",
  "CI/CD",
  "GitOps",
  "Feature Flags",
  "Blue-Green Deploy",
  "Canary Release",
  "Design Systems",
  "Accessibility",
  "UX",
  "Interaction Design",
  "Typography",
  "Data Engineering",
  "ETL",
  "Stream Processing",
  "Data Lake",
  "Data Warehouse",
  "Distributed Systems",
  "Consensus",
  "CAP Theorem",
  "Eventual Consistency",
  "CRDTs",
  "Functional Programming",
  "Domain Theory",
  "Type Theory",
  "Linear Types",
  "Operating Systems",
  "Linux",
  "eBPF",
  "Kernel",
  "Containers",
  "Virtualization",
];

const VERBS = [
  "explores",
  "investigates",
  "analyzes",
  "proposes",
  "critiques",
  "compares",
  "contrasts",
  "synthesizes",
  "deconstructs",
  "reconstructs",
  "optimizes",
  "refactors",
  "extends",
  "generalizes",
  "formalizes",
  "visualizes",
  "models",
  "simulates",
  "benchmarks",
  "profiles",
  "monitors",
  "traces",
  "audits",
  "secures",
  "hardens",
  "scales",
  "shards",
  "replicates",
  "indexes",
  "caches",
  "queues",
  "streams",
  "batches",
  "pipelines",
  "orchestrates",
];

const BODY_TEMPLATES = [
  (s: string, v: string) =>
    `This ${v} the relationship between ${s} and modern software architecture. Key considerations include scalability, maintainability, and developer experience. We should evaluate tradeoffs carefully before adopting this in production.`,
  (s: string, v: string) =>
    `A deep dive into how ${s} ${v} common patterns in distributed systems. The implications for system design are significant, particularly around consistency models and failure handling.`,
  (s: string, v: string) =>
    `${s} presents interesting challenges when ${v} at scale. Throughput bottlenecks, memory pressure, and network latency all become critical factors that demand careful measurement and tuning.`,
  (s: string, v: string) =>
    `When ${v} ${s}, several anti-patterns emerge:\n1. Premature optimization without metrics\n2. Ignoring operational complexity\n3. Underestimating migration cost\n4. Over-engineering for hypothetical scale`,
  (s: string, v: string) =>
    `The core insight is that ${s} fundamentally changes how we ${v} state management. This has ripple effects across the entire stack, from the database layer up to the UI.`,
  (s: string, _v: string) =>
    `Comparing ${s} with alternatives reveals subtle but important differences:\n- Latency characteristics\n- Fault tolerance behavior\n- Operational overhead\n- Team cognitive load`,
  (s: string, v: string) =>
    `This approach to ${s} emphasizes ${v} through composition rather than inheritance. The resulting code tends to be more modular and easier to test in isolation.`,
  (s: string, v: string) =>
    `A practical case study: using ${s} to ${v} a high-traffic API. Results showed 40% reduction in p99 latency and 60% decrease in error rates under load.`,
  (s: string, v: string) =>
    `The theoretical foundations of ${s} suggest that ${v} is only optimal under specific conditions. We need to characterize the workload before making architectural decisions.`,
  (s: string, _v: string) =>
    `Questions to answer:\n- Does ${s} support the throughput we need?\n- How does it behave under partition?\n- What is the operational learning curve?\n- Can we roll back easily?`,
];

const WIKI_LINK_SUBJECTS = [
  "React Server Components",
  "React Suspense",
  "Vue Reactivity",
  "CSS Container Queries",
  "Database Indexing",
  "REST API Design",
  "GraphQL Tradeoffs",
  "Long Path 2",
  "Long Path 3",
  "Long Path 4",
  "Long Path 5",
  "Star Center",
  "Circular B",
  "Circular C",
  "Branch A",
  "Branch B",
  "Branch C",
  "Bidirectional Link B",
  "Dense Cluster Center",
  "Dense Cluster 2",
  "Dense Cluster 3",
];

function generateTitle(idx: number): string {
  const prefix = UNDERSTANDING_PREFIXES[idx % UNDERSTANDING_PREFIXES.length];
  const subject = SUBJECTS[idx % SUBJECTS.length];
  const verb = VERBS[idx % VERBS.length];
  return `${prefix}: ${subject} ${verb}`;
}

function generateBody(idx: number, includeWikiLink: boolean): string {
  const subject = SUBJECTS[idx % SUBJECTS.length];
  const verb = VERBS[idx % VERBS.length];
  const template = BODY_TEMPLATES[idx % BODY_TEMPLATES.length];
  let body = template(subject, verb);

  if (includeWikiLink) {
    const linkTarget = WIKI_LINK_SUBJECTS[idx % WIKI_LINK_SUBJECTS.length];
    body += `\n\nSee also [[${linkTarget}]] for related discussion.`;
  }

  // Occasionally generate very long bodies
  if (idx % 17 === 0) {
    body +=
      "\n\n" + Array(10).fill("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ").join("");
  }

  return body;
}

// ---------------------------------------------------------------------------
// Domains (multi-level nested, 20 total)
// ---------------------------------------------------------------------------

type SeedDomain = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const domains: SeedDomain[] = [
  // Root level (5)
  {
    id: generateId("dom"),
    name: "Programming",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(365),
    updatedAt: isoDate(10),
  },
  {
    id: generateId("dom"),
    name: "Design",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(360),
    updatedAt: isoDate(9),
  },
  {
    id: generateId("dom"),
    name: "Research",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(350),
    updatedAt: isoDate(8),
  },
  {
    id: generateId("dom"),
    name: "Life",
    parentId: null,
    sortOrder: 3,
    createdAt: isoDate(340),
    updatedAt: isoDate(7),
  },
  {
    id: generateId("dom"),
    name: "Reading",
    parentId: null,
    sortOrder: 4,
    createdAt: isoDate(330),
    updatedAt: isoDate(6),
  },
  // Level 2 (8)
  {
    id: generateId("dom"),
    name: "Frontend",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(300),
    updatedAt: isoDate(20),
  },
  {
    id: generateId("dom"),
    name: "Backend",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(295),
    updatedAt: isoDate(19),
  },
  {
    id: generateId("dom"),
    name: "DevOps",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(290),
    updatedAt: isoDate(18),
  },
  {
    id: generateId("dom"),
    name: "AI",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(280),
    updatedAt: isoDate(17),
  },
  {
    id: generateId("dom"),
    name: "Data Science",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(275),
    updatedAt: isoDate(16),
  },
  {
    id: generateId("dom"),
    name: "Fiction",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(270),
    updatedAt: isoDate(15),
  },
  {
    id: generateId("dom"),
    name: "Non-fiction",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(265),
    updatedAt: isoDate(14),
  },
  {
    id: generateId("dom"),
    name: "Essays",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(260),
    updatedAt: isoDate(13),
  },
  // Level 3 (7)
  {
    id: generateId("dom"),
    name: "React",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(250),
    updatedAt: isoDate(12),
  },
  {
    id: generateId("dom"),
    name: "Vue",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(245),
    updatedAt: isoDate(11),
  },
  {
    id: generateId("dom"),
    name: "CSS",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(240),
    updatedAt: isoDate(10),
  },
  {
    id: generateId("dom"),
    name: "Node.js",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(235),
    updatedAt: isoDate(9),
  },
  {
    id: generateId("dom"),
    name: "Database",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(230),
    updatedAt: isoDate(8),
  },
  {
    id: generateId("dom"),
    name: "API Design",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(225),
    updatedAt: isoDate(7),
  },
  {
    id: generateId("dom"),
    name: "Tech Books",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(220),
    updatedAt: isoDate(6),
  },
];

// Fix parent IDs
domains[5].parentId = domains[0].id; // Frontend -> Programming
domains[6].parentId = domains[0].id; // Backend -> Programming
domains[7].parentId = domains[0].id; // DevOps -> Programming
domains[8].parentId = domains[2].id; // AI -> Research
domains[9].parentId = domains[2].id; // Data Science -> Research
domains[10].parentId = domains[4].id; // Fiction -> Reading
domains[11].parentId = domains[4].id; // Non-fiction -> Reading
domains[12].parentId = domains[3].id; // Essays -> Life
domains[13].parentId = domains[5].id; // React -> Frontend
domains[14].parentId = domains[5].id; // Vue -> Frontend
domains[15].parentId = domains[5].id; // CSS -> Frontend
domains[16].parentId = domains[6].id; // Node.js -> Backend
domains[17].parentId = domains[6].id; // Database -> Backend
domains[18].parentId = domains[6].id; // API Design -> Backend
domains[19].parentId = domains[11].id; // Tech Books -> Non-fiction

const insertDomain = db.prepare(
  "INSERT INTO domains (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
);
for (const c of domains) {
  insertDomain.run(c.id, c.name, c.parentId, c.sortOrder, c.createdAt, c.updatedAt);
}
console.log(`Inserted ${domains.length} domains`);

const allDomainIds = domains.map((c) => c.id);
const leafDomainIds = domains
  .filter((c) => !domains.some((p) => p.parentId === c.id))
  .map((c) => c.id);

// ---------------------------------------------------------------------------
// Special anchor understandings (fixed titles for graph / search tests)
// ---------------------------------------------------------------------------

const anchorUnderstandings: Array<{
  title?: string;
  body: string;
  daysAgo: number;
  hoursOffset: number;
  deleted?: boolean;
  noDomain?: boolean;
  domainCount?: number;
}> = [
  // Graph structures
  {
    title: "React Server Components",
    body: "RSC allows server-side rendering of components without shipping JS to client. Could be combined with [[React Suspense]] for progressive hydration.",
    daysAgo: 1,
    hoursOffset: 2,
    domainCount: 2,
  },
  {
    title: "React Suspense",
    body: "Suspense boundaries let us declaratively specify loading states. Should explore integration with data fetching patterns.",
    daysAgo: 2,
    hoursOffset: 4,
    domainCount: 1,
  },
  {
    title: "Vue Reactivity",
    body: "Proxy-based reactivity system in Vue 3 is elegant. How does it compare to [[React Server Components]] architecture?",
    daysAgo: 4,
    hoursOffset: 3,
    domainCount: 1,
  },
  {
    title: "CSS Container Queries",
    body: "Container queries enable component-level responsive design without media queries. A game changer for design systems.",
    daysAgo: 5,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Database Indexing",
    body: "Proper indexing can improve query performance by orders of magnitude. B-trees vs hash indexes vs GiST.",
    daysAgo: 7,
    hoursOffset: 2,
    domainCount: 1,
  },
  {
    title: "REST API Design",
    body: "REST is not dead. HATEOAS and content negotiation are still underutilized. See also [[GraphQL Tradeoffs]].",
    daysAgo: 8,
    hoursOffset: 6,
    domainCount: 2,
  },
  {
    title: "GraphQL Tradeoffs",
    body: "GraphQL solves over-fetching but introduces N+1 problems. Compare with [[REST API Design]] approaches.",
    daysAgo: 9,
    hoursOffset: 1,
    domainCount: 2,
  },
  {
    title: "Circular A",
    body: "Points to [[Circular B]] to create a cycle in the graph.",
    daysAgo: 25,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Circular B",
    body: "Points to [[Circular C]] continuing the cycle.",
    daysAgo: 26,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Circular C",
    body: "Points back to [[Circular A]] completing the cycle.",
    daysAgo: 27,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Star Center",
    body: "This is the center of a star graph. Many understandings link here.",
    daysAgo: 5,
    hoursOffset: 0,
    domainCount: 2,
  },
  {
    title: "Star Leaf 1",
    body: "Links to [[Star Center]] as leaf 1.",
    daysAgo: 6,
    hoursOffset: 1,
    domainCount: 1,
  },
  {
    title: "Star Leaf 2",
    body: "Links to [[Star Center]] as leaf 2.",
    daysAgo: 6,
    hoursOffset: 2,
    domainCount: 1,
  },
  {
    title: "Star Leaf 3",
    body: "Links to [[Star Center]] as leaf 3.",
    daysAgo: 6,
    hoursOffset: 3,
    domainCount: 1,
  },
  {
    title: "Long Path Start",
    body: "Start of a 5-hop path. Next is [[Long Path 2]].",
    daysAgo: 40,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Long Path 2",
    body: "Second hop. Next is [[Long Path 3]].",
    daysAgo: 41,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Long Path 3",
    body: "Third hop. Next is [[Long Path 4]].",
    daysAgo: 42,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Long Path 4",
    body: "Fourth hop. Next is [[Long Path 5]].",
    daysAgo: 43,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Long Path 5",
    body: "End of the 5-hop path. No further links.",
    daysAgo: 44,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Branch Point",
    body: "This understanding branches to [[Branch A]] and [[Branch B]] and [[Branch C]].",
    daysAgo: 50,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Branch A",
    body: "Leaf A from branch point.",
    daysAgo: 51,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Branch B",
    body: "Leaf B from branch point.",
    daysAgo: 51,
    hoursOffset: 1,
    domainCount: 1,
  },
  {
    title: "Branch C",
    body: "Leaf C from branch point.",
    daysAgo: 51,
    hoursOffset: 2,
    domainCount: 1,
  },
  {
    title: "Bidirectional Link A",
    body: "Links to [[Bidirectional Link B]] and is linked back.",
    daysAgo: 33,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Bidirectional Link B",
    body: "Links to [[Bidirectional Link A]] creating a mutual reference.",
    daysAgo: 34,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Dense Cluster Center",
    body: "Central node in a dense cluster.",
    daysAgo: 60,
    hoursOffset: 0,
    domainCount: 2,
  },
  {
    title: "Dense Cluster 1",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 2]].",
    daysAgo: 61,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Dense Cluster 2",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 3]].",
    daysAgo: 61,
    hoursOffset: 1,
    domainCount: 1,
  },
  {
    title: "Dense Cluster 3",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 1]].",
    daysAgo: 61,
    hoursOffset: 2,
    domainCount: 1,
  },

  // Search anchors
  {
    title: "Search Test Alpha",
    body: "This content contains the unique keyword ALPHA_SEED_42 for testing full-text search precision.",
    daysAgo: 2,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Search Test Beta",
    body: "Another unique keyword BETA_SEED_99 appears here for search testing.",
    daysAgo: 3,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Search Test Gamma",
    body: "Both ALPHA_SEED_42 and BETA_SEED_99 appear in this understanding for multi-term search.",
    daysAgo: 4,
    hoursOffset: 0,
    domainCount: 1,
  },

  // Edge cases
  {
    title: "Soft Deleted Understanding A",
    body: "This understanding is soft deleted and should not appear in normal queries.",
    daysAgo: 20,
    hoursOffset: 0,
    deleted: true,
    domainCount: 1,
  },
  {
    title: "Soft Deleted Understanding B",
    body: "Another deleted understanding for testing edge cases.",
    daysAgo: 21,
    hoursOffset: 0,
    deleted: true,
    noDomain: true,
  },
  {
    title: "Soft Deleted Understanding C",
    body: "Third deleted understanding with multiple domains.",
    daysAgo: 22,
    hoursOffset: 0,
    deleted: true,
    domainCount: 3,
  },
  {
    title: "Soft Deleted Insight",
    body: "This insight is deleted.",
    daysAgo: 15,
    hoursOffset: 0,
    deleted: true,
    domainCount: 1,
  },
  {
    title: "Unconnected Node",
    body: "This understanding has no wiki links and no domains. It is an island.",
    daysAgo: 30,
    hoursOffset: 0,
    noDomain: true,
  },
  {
    title: "Insight Without Domain",
    body: "An insight that belongs to no domain. Testing the zero-association case.",
    daysAgo: 12,
    hoursOffset: 0,
    noDomain: true,
  },
  {
    body: "Untitled understanding: sometimes rough context is enough without a formal title.",
    daysAgo: 0,
    hoursOffset: 1,
    domainCount: 1,
  },
  {
    body: "Untitled understanding: sometimes rough context is enough without a formal title.",
    daysAgo: 11,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Empty Body Understanding",
    body: "",
    daysAgo: 16,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Very Old Understanding",
    body: "This is from the beginning of the knowledge base. Just a placeholder with minimal content.",
    daysAgo: 300,
    hoursOffset: 0,
    domainCount: 1,
  },
  {
    title: "Future Understanding",
    body: "Dated slightly in the future to test sorting edge cases.",
    daysAgo: -1,
    hoursOffset: 0,
    domainCount: 1,
  },
];

// ---------------------------------------------------------------------------
// Generated understandings (bulk)
// ---------------------------------------------------------------------------

const TOTAL_UNDERSTANDINGS = 200;
const generatedUnderstandings: typeof anchorUnderstandings = [];

for (let i = 0; i < TOTAL_UNDERSTANDINGS - anchorUnderstandings.length; i++) {
  const daysAgo = rng.int(0, 365);
  const hoursOffset = rng.int(0, 23);

  // 5% chance of no title
  const noTitle = rng.bool(0.05);
  // 3% chance of empty body
  const emptyBody = rng.bool(0.03);
  // 8% chance of no domain
  const noDomain = rng.bool(0.08);
  // 5% chance of deleted
  const deleted = rng.bool(0.05);
  // 30% chance of wiki link
  const hasWikiLink = rng.bool(0.3);

  const title = noTitle ? undefined : generateTitle(i);
  const body = emptyBody ? "" : generateBody(i, hasWikiLink);

  generatedUnderstandings.push({
    title,
    body,
    daysAgo,
    hoursOffset,
    deleted,
    noDomain,
    domainCount: noDomain ? undefined : rng.int(1, 3),
  });
}

const allUnderstandingTemplates = [...anchorUnderstandings, ...generatedUnderstandings];

type UnderstandingSeed = (typeof allUnderstandingTemplates)[number] & {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const understandingSeeds: UnderstandingSeed[] = allUnderstandingTemplates.map((t) => ({
  ...t,
  id: generateId("th"),
  createdAt: isoDate(t.daysAgo, (t.hoursOffset ?? 0) + 1),
  updatedAt: isoDate(t.daysAgo, t.hoursOffset ?? 0),
  deletedAt: t.deleted ? isoDate(t.daysAgo, (t.hoursOffset ?? 0) - 1) : null,
}));

const insertUnderstanding = db.prepare(
  "INSERT INTO understandings (id, title, body, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)",
);
for (const t of understandingSeeds) {
  insertUnderstanding.run(t.id, t.title ?? null, t.body, t.createdAt, t.updatedAt, t.deletedAt);
}
console.log(`Inserted ${understandingSeeds.length} understandings`);

const activeUnderstandingIds = understandingSeeds.filter((t) => !t.deleted).map((t) => t.id);
// deleted understandings are tracked implicitly

// ---------------------------------------------------------------------------
// Understanding-Domains associations
// ---------------------------------------------------------------------------

const insertTC = db.prepare(
  "INSERT INTO understanding_domains (understanding_id, domain_id) VALUES (?, ?)",
);
let tcCount = 0;

for (const t of understandingSeeds) {
  if (t.noDomain) continue;
  const count = t.domainCount ?? rng.int(1, 3);
  // Bias toward leaf domains but allow any
  const pool = rng.bool(0.6) ? allDomainIds : leafDomainIds;
  const cats = rng.pickUnique(pool, count);
  for (const catId of cats) {
    insertTC.run(t.id, catId);
    tcCount++;
  }
}
console.log(`Inserted ${tcCount} understanding-domain links`);

// ---------------------------------------------------------------------------
// Understanding-Connections (via wiki-link resolution)
// ---------------------------------------------------------------------------

const insertConn = db.prepare(
  "INSERT INTO understanding_connections (source_id, target_id) VALUES (?, ?)",
);
const connectionSet = new Set<string>();
let connCount = 0;

for (const t of understandingSeeds) {
  if (t.deleted) continue;
  const matches = t.body.matchAll(/\[\[(.+?)\]\]/g);
  for (const match of matches) {
    const linkTitle = match[1];
    const target = understandingSeeds.find((x) => x.title === linkTitle && !x.deleted);
    if (target && target.id !== t.id) {
      const key = `${t.id}->${target.id}`;
      if (!connectionSet.has(key)) {
        connectionSet.add(key);
        insertConn.run(t.id, target.id);
        connCount++;
      }
    }
  }
}

// Add extra random connections to create more graph complexity
for (let i = 0; i < 80; i++) {
  const source = rng.pick(activeUnderstandingIds);
  const target = rng.pick(activeUnderstandingIds);
  if (source !== target) {
    const key = `${source}->${target}`;
    if (!connectionSet.has(key)) {
      connectionSet.add(key);
      insertConn.run(source, target);
      connCount++;
    }
  }
}

console.log(`Inserted ${connCount} understanding connections`);

// ---------------------------------------------------------------------------
// Contexts (varied mediums, titles, deletion states)
// ---------------------------------------------------------------------------

const mediums = ["experience", "book", "article", "opinion", "ai", "video", "other"];

const contextTemplates = [
  {
    medium: "other",
    title: "github.com/vercel/next.js",
    content:
      "Next.js App Router implementation details. The layout.tsx file handles nested routing.",
  },
  {
    medium: "experience",
    title: "Meeting Context 2024-03",
    content: "Discussed migration strategy from Pages Router to App Router. Estimated 3 sprints.",
  },
  {
    medium: "other",
    title: "React Docs",
    content: "https://react.dev/reference/react/Suspense - Official Suspense documentation",
  },
  {
    medium: "article",
    title: "Kent C. Dodds Blog",
    content: "Why I love React Server Components and how they change the data fetching paradigm.",
  },
  {
    medium: "experience",
    title: "Slack #frontend",
    content: "Team agreed to adopt RSC for new features but keep existing pages as-is.",
  },
  {
    medium: "other",
    title: "src/components/Modal.tsx",
    content:
      "Modal component using React Portal and focus trap. Accessibility considerations included.",
  },
  {
    medium: "book",
    title: "Drizzle ORM Docs",
    content: "Drizzle uses relational syntax for queries. Much closer to SQL than Prisma.",
  },
  {
    medium: "video",
    title: "YouTube: System Design Interview",
    content: "Key takeaways: caching layers, CDN, database read replicas, and message queues.",
  },
  {
    medium: "opinion",
    title: "Backend Engineering Show",
    content: "Episode on API versioning strategies. URL versioning vs header versioning debate.",
  },
  {
    medium: "experience",
    title: null,
    content: "Open question: what if we used CRDTs for real-time collaborative editing?",
  },
  {
    medium: "other",
    title: "Hacker News",
    content:
      "Top post about a new Rust web framework. Interesting benchmarks against Axum and Actix.",
  },
  {
    medium: "article",
    title: "ACM Queue",
    content: "Paper on distributed consensus. Paxos vs Raft vs ZAB compared empirically.",
  },
  {
    medium: "other",
    title: "Dockerfile",
    content: "Multi-stage build reducing image size from 800MB to 45MB.",
  },
  {
    medium: "experience",
    title: "1:1 with Manager",
    content: "Career goals discussion. Want to focus more on system design and architecture.",
  },
  {
    medium: "experience",
    title: "Daily Journal",
    content: "Read 30 pages of 'Designing Data-Intensive Applications'. Chapter on replication.",
  },
  {
    medium: "other",
    title: "MDN Web Docs",
    content: "Container queries now supported in all major browsers. Time to refactor components.",
  },
  {
    medium: "article",
    title: "Vercel Engineering Blog",
    content: "How Vercel handles millions of deploys per day. Edge functions and caching strategy.",
  },
  {
    medium: "video",
    title: "Confreaks: React Conf 2024",
    content:
      "New React compiler optimizes re-renders automatically. No more useMemo in most cases.",
  },
  {
    medium: "other",
    title: "benchmark.rs",
    content: "Benchmark results: 50k req/s on a single core. Memory usage stable at 12MB.",
  },
  {
    medium: "other",
    title: "OpenAPI Spec",
    content: "Version 3.1 spec for the public API. Need to add webhook definitions.",
  },
];

const insertContext = db.prepare(
  "INSERT INTO contexts (id, understanding_id, medium, title, content, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
let ctxCount = 0;

// Insert template contexts
for (let i = 0; i < contextTemplates.length * 2; i++) {
  const tpl = contextTemplates[i % contextTemplates.length];
  const understandingId = activeUnderstandingIds[i % activeUnderstandingIds.length];
  insertContext.run(
    generateId("ctx"),
    understandingId,
    tpl.medium,
    tpl.title,
    `${tpl.content} (variant ${i})`,
    isoDate(rng.int(0, 100), rng.int(0, 23)),
    null,
  );
  ctxCount++;
}

// Generate random contexts for understandings
for (const understandingId of activeUnderstandingIds) {
  const numContexts = rng.int(0, 4);
  for (let i = 0; i < numContexts; i++) {
    const type = rng.pick(mediums);
    const hasName = rng.bool(0.7);
    const name = hasName ? `${type}-context-${rng.int(1, 999)}` : null;
    const paragraphs = rng.int(1, 5);
    const content = Array(paragraphs)
      .fill(0)
      .map((_, j) => `Paragraph ${j + 1}: ${generateBody(rng.int(0, 999), false)}`)
      .join("\n\n");
    insertContext.run(
      generateId("ctx"),
      understandingId,
      type,
      name,
      content,
      isoDate(rng.int(0, 200), rng.int(0, 23)),
      null,
    );
    ctxCount++;
  }
}

// Add deleted contexts
for (let i = 0; i < 20; i++) {
  const understandingId = rng.pick(activeUnderstandingIds);
  insertContext.run(
    generateId("ctx"),
    understandingId,
    rng.pick(mediums),
    `Deleted Context ${i}`,
    `This context is soft-deleted. Content number ${i}.`,
    isoDate(50, 0),
    isoDate(40, 0),
  );
  ctxCount++;
}

console.log(`Inserted ${ctxCount} contexts`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const domainCount = (db.query("SELECT count(*) AS c FROM domains").get() as { c: number }).c;
const understandingCount = (
  db.query("SELECT count(*) AS c FROM understandings").get() as { c: number }
).c;
const activeUnderstandingCount = (
  db.query("SELECT count(*) AS c FROM understandings WHERE deleted_at IS NULL").get() as {
    c: number;
  }
).c;
const deletedUnderstandingCount = (
  db.query("SELECT count(*) AS c FROM understandings WHERE deleted_at IS NOT NULL").get() as {
    c: number;
  }
).c;
const connectionCount = (
  db.query("SELECT count(*) AS c FROM understanding_connections").get() as { c: number }
).c;
const contextTotal = (db.query("SELECT count(*) AS c FROM contexts").get() as { c: number }).c;
const activeCtxCount = (
  db.query("SELECT count(*) AS c FROM contexts WHERE deleted_at IS NULL").get() as { c: number }
).c;
const deletedCtxCount = (
  db.query("SELECT count(*) AS c FROM contexts WHERE deleted_at IS NOT NULL").get() as { c: number }
).c;

console.log("\n✅ Seed complete! Summary:");
console.log(`   Domains:        ${domainCount}`);
console.log(
  `   Understandings:          ${understandingCount} (active: ${activeUnderstandingCount}, deleted: ${deletedUnderstandingCount})`,
);
console.log(`   Connections:       ${connectionCount}`);
console.log(
  `   Contexts:          ${contextTotal} (active: ${activeCtxCount}, deleted: ${deletedCtxCount})`,
);
console.log(`   Database:          ${dbPath}`);

const findUnderstanding = (title: string) => understandingSeeds.find((t) => t.title === title);

console.log("\n📌 Sample IDs for testing:");
console.log(`   Domain (root):   ${domains[0].id}`);
console.log(`   Domain (L2):     ${domains[5].id}`);
console.log(`   Domain (L3):     ${domains[13].id}`);
console.log(`   Understanding (sample):  ${findUnderstanding("React Server Components")?.id}`);
console.log(`   Understanding (linked):  ${findUnderstanding("Bidirectional Link A")?.id}`);
console.log(`   Understanding (deleted): ${findUnderstanding("Soft Deleted Understanding A")?.id}`);
console.log(`   Understanding (no domain): ${findUnderstanding("Unconnected Node")?.id}`);
console.log(`   Understanding (path):    ${findUnderstanding("Long Path Start")?.id}`);
console.log(`   Understanding (cycle):   ${findUnderstanding("Circular A")?.id}`);
console.log(`   Understanding (star):    ${findUnderstanding("Star Center")?.id}`);
console.log(`   Understanding (search):  ${findUnderstanding("Search Test Alpha")?.id}`);
const deletedCtxSample = db
  .query("SELECT id FROM contexts WHERE deleted_at IS NOT NULL LIMIT 1")
  .get() as { id: string } | undefined;
console.log(`   Context (deleted): ${deletedCtxSample?.id ?? "none"}`);

db.close();
