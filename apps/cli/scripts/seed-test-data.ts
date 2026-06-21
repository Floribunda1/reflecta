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

function ensureFtsTables() {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_thoughts USING fts5(
      thought_id UNINDEXED,
      title,
      body
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS fts_contexts USING fts5(
      context_id UNINDEXED,
      thought_id UNINDEXED,
      source_name,
      content
    );
  `);
}

if (!isNewDb) {
  ensureFtsTables();
  console.log("Database exists. Truncating tables before seeding...");
  try {
    db.exec(`
      DELETE FROM thought_categories;
      DELETE FROM thought_connections;
      DELETE FROM contexts;
      DELETE FROM thoughts;
      DELETE FROM categories;
      DELETE FROM fts_thoughts;
      DELETE FROM fts_contexts;
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

const IDEA_PREFIXES = [
  "Idea",
  "Concept",
  "Experiment",
  "Draft",
  "Sketch",
  "Note",
  "Plan",
  "Proposal",
  "Hypothesis",
  "Question",
  "Exploration",
  "Prototype",
  "Spike",
  "Investigation",
  "Thought Experiment",
  "Design Doc",
  "RFC",
  "ADR",
  "Brainstorm",
  "Outline",
];

const INSIGHT_PREFIXES = [
  "Insight",
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
  "Category Theory",
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

function generateTitle(type: "idea" | "insight", idx: number): string {
  const prefixes = type === "idea" ? IDEA_PREFIXES : INSIGHT_PREFIXES;
  const prefix = prefixes[idx % prefixes.length];
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
// Categories (multi-level nested, 20 total)
// ---------------------------------------------------------------------------

type SeedCategory = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const categories: SeedCategory[] = [
  // Root level (5)
  {
    id: generateId("cat"),
    name: "Programming",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(365),
    updatedAt: isoDate(10),
  },
  {
    id: generateId("cat"),
    name: "Design",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(360),
    updatedAt: isoDate(9),
  },
  {
    id: generateId("cat"),
    name: "Research",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(350),
    updatedAt: isoDate(8),
  },
  {
    id: generateId("cat"),
    name: "Life",
    parentId: null,
    sortOrder: 3,
    createdAt: isoDate(340),
    updatedAt: isoDate(7),
  },
  {
    id: generateId("cat"),
    name: "Reading",
    parentId: null,
    sortOrder: 4,
    createdAt: isoDate(330),
    updatedAt: isoDate(6),
  },
  // Level 2 (8)
  {
    id: generateId("cat"),
    name: "Frontend",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(300),
    updatedAt: isoDate(20),
  },
  {
    id: generateId("cat"),
    name: "Backend",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(295),
    updatedAt: isoDate(19),
  },
  {
    id: generateId("cat"),
    name: "DevOps",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(290),
    updatedAt: isoDate(18),
  },
  {
    id: generateId("cat"),
    name: "AI",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(280),
    updatedAt: isoDate(17),
  },
  {
    id: generateId("cat"),
    name: "Data Science",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(275),
    updatedAt: isoDate(16),
  },
  {
    id: generateId("cat"),
    name: "Fiction",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(270),
    updatedAt: isoDate(15),
  },
  {
    id: generateId("cat"),
    name: "Non-fiction",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(265),
    updatedAt: isoDate(14),
  },
  {
    id: generateId("cat"),
    name: "Essays",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(260),
    updatedAt: isoDate(13),
  },
  // Level 3 (7)
  {
    id: generateId("cat"),
    name: "React",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(250),
    updatedAt: isoDate(12),
  },
  {
    id: generateId("cat"),
    name: "Vue",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(245),
    updatedAt: isoDate(11),
  },
  {
    id: generateId("cat"),
    name: "CSS",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(240),
    updatedAt: isoDate(10),
  },
  {
    id: generateId("cat"),
    name: "Node.js",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(235),
    updatedAt: isoDate(9),
  },
  {
    id: generateId("cat"),
    name: "Database",
    parentId: null,
    sortOrder: 1,
    createdAt: isoDate(230),
    updatedAt: isoDate(8),
  },
  {
    id: generateId("cat"),
    name: "API Design",
    parentId: null,
    sortOrder: 2,
    createdAt: isoDate(225),
    updatedAt: isoDate(7),
  },
  {
    id: generateId("cat"),
    name: "Tech Books",
    parentId: null,
    sortOrder: 0,
    createdAt: isoDate(220),
    updatedAt: isoDate(6),
  },
];

// Fix parent IDs
categories[5].parentId = categories[0].id; // Frontend -> Programming
categories[6].parentId = categories[0].id; // Backend -> Programming
categories[7].parentId = categories[0].id; // DevOps -> Programming
categories[8].parentId = categories[2].id; // AI -> Research
categories[9].parentId = categories[2].id; // Data Science -> Research
categories[10].parentId = categories[4].id; // Fiction -> Reading
categories[11].parentId = categories[4].id; // Non-fiction -> Reading
categories[12].parentId = categories[3].id; // Essays -> Life
categories[13].parentId = categories[5].id; // React -> Frontend
categories[14].parentId = categories[5].id; // Vue -> Frontend
categories[15].parentId = categories[5].id; // CSS -> Frontend
categories[16].parentId = categories[6].id; // Node.js -> Backend
categories[17].parentId = categories[6].id; // Database -> Backend
categories[18].parentId = categories[6].id; // API Design -> Backend
categories[19].parentId = categories[11].id; // Tech Books -> Non-fiction

const insertCategory = db.prepare(
  "INSERT INTO categories (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
);
for (const c of categories) {
  insertCategory.run(c.id, c.name, c.parentId, c.sortOrder, c.createdAt, c.updatedAt);
}
console.log(`Inserted ${categories.length} categories`);

const allCategoryIds = categories.map((c) => c.id);
const leafCategoryIds = categories
  .filter((c) => !categories.some((p) => p.parentId === c.id))
  .map((c) => c.id);

// ---------------------------------------------------------------------------
// Special anchor thoughts (fixed titles for graph / search tests)
// ---------------------------------------------------------------------------

const anchorThoughts: Array<{
  title?: string;
  body: string;
  daysAgo: number;
  hoursOffset: number;
  deleted?: boolean;
  noCategory?: boolean;
  categoryCount?: number;
}> = [
  // Graph structures
  {
    title: "React Server Components",
    body: "RSC allows server-side rendering of components without shipping JS to client. Could be combined with [[React Suspense]] for progressive hydration.",
    daysAgo: 1,
    hoursOffset: 2,
    categoryCount: 2,
  },
  {
    title: "React Suspense",
    body: "Suspense boundaries let us declaratively specify loading states. Should explore integration with data fetching patterns.",
    daysAgo: 2,
    hoursOffset: 4,
    categoryCount: 1,
  },
  {
    title: "Vue Reactivity",
    body: "Proxy-based reactivity system in Vue 3 is elegant. How does it compare to [[React Server Components]] architecture?",
    daysAgo: 4,
    hoursOffset: 3,
    categoryCount: 1,
  },
  {
    title: "CSS Container Queries",
    body: "Container queries enable component-level responsive design without media queries. A game changer for design systems.",
    daysAgo: 5,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Database Indexing",
    body: "Proper indexing can improve query performance by orders of magnitude. B-trees vs hash indexes vs GiST.",
    daysAgo: 7,
    hoursOffset: 2,
    categoryCount: 1,
  },
  {
    title: "REST API Design",
    body: "REST is not dead. HATEOAS and content negotiation are still underutilized. See also [[GraphQL Tradeoffs]].",
    daysAgo: 8,
    hoursOffset: 6,
    categoryCount: 2,
  },
  {
    title: "GraphQL Tradeoffs",
    body: "GraphQL solves over-fetching but introduces N+1 problems. Compare with [[REST API Design]] approaches.",
    daysAgo: 9,
    hoursOffset: 1,
    categoryCount: 2,
  },
  {
    title: "Circular A",
    body: "Points to [[Circular B]] to create a cycle in the graph.",
    daysAgo: 25,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Circular B",
    body: "Points to [[Circular C]] continuing the cycle.",
    daysAgo: 26,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Circular C",
    body: "Points back to [[Circular A]] completing the cycle.",
    daysAgo: 27,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Star Center",
    body: "This is the center of a star graph. Many thoughts link here.",
    daysAgo: 5,
    hoursOffset: 0,
    categoryCount: 2,
  },
  {
    title: "Star Leaf 1",
    body: "Links to [[Star Center]] as leaf 1.",
    daysAgo: 6,
    hoursOffset: 1,
    categoryCount: 1,
  },
  {
    title: "Star Leaf 2",
    body: "Links to [[Star Center]] as leaf 2.",
    daysAgo: 6,
    hoursOffset: 2,
    categoryCount: 1,
  },
  {
    title: "Star Leaf 3",
    body: "Links to [[Star Center]] as leaf 3.",
    daysAgo: 6,
    hoursOffset: 3,
    categoryCount: 1,
  },
  {
    title: "Long Path Start",
    body: "Start of a 5-hop path. Next is [[Long Path 2]].",
    daysAgo: 40,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Long Path 2",
    body: "Second hop. Next is [[Long Path 3]].",
    daysAgo: 41,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Long Path 3",
    body: "Third hop. Next is [[Long Path 4]].",
    daysAgo: 42,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Long Path 4",
    body: "Fourth hop. Next is [[Long Path 5]].",
    daysAgo: 43,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Long Path 5",
    body: "End of the 5-hop path. No further links.",
    daysAgo: 44,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Branch Point",
    body: "This thought branches to [[Branch A]] and [[Branch B]] and [[Branch C]].",
    daysAgo: 50,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Branch A",
    body: "Leaf A from branch point.",
    daysAgo: 51,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Branch B",
    body: "Leaf B from branch point.",
    daysAgo: 51,
    hoursOffset: 1,
    categoryCount: 1,
  },
  {
    title: "Branch C",
    body: "Leaf C from branch point.",
    daysAgo: 51,
    hoursOffset: 2,
    categoryCount: 1,
  },
  {
    title: "Bidirectional Link A",
    body: "Links to [[Bidirectional Link B]] and is linked back.",
    daysAgo: 33,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Bidirectional Link B",
    body: "Links to [[Bidirectional Link A]] creating a mutual reference.",
    daysAgo: 34,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Dense Cluster Center",
    body: "Central node in a dense cluster.",
    daysAgo: 60,
    hoursOffset: 0,
    categoryCount: 2,
  },
  {
    title: "Dense Cluster 1",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 2]].",
    daysAgo: 61,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Dense Cluster 2",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 3]].",
    daysAgo: 61,
    hoursOffset: 1,
    categoryCount: 1,
  },
  {
    title: "Dense Cluster 3",
    body: "Links to [[Dense Cluster Center]] and [[Dense Cluster 1]].",
    daysAgo: 61,
    hoursOffset: 2,
    categoryCount: 1,
  },

  // Search anchors
  {
    title: "Search Test Alpha",
    body: "This content contains the unique keyword ALPHA_SEED_42 for testing full-text search precision.",
    daysAgo: 2,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Search Test Beta",
    body: "Another unique keyword BETA_SEED_99 appears here for search testing.",
    daysAgo: 3,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Search Test Gamma",
    body: "Both ALPHA_SEED_42 and BETA_SEED_99 appear in this thought for multi-term search.",
    daysAgo: 4,
    hoursOffset: 0,
    categoryCount: 1,
  },

  // Edge cases
  {
    title: "Soft Deleted Thought A",
    body: "This thought is soft deleted and should not appear in normal queries.",
    daysAgo: 20,
    hoursOffset: 0,
    deleted: true,
    categoryCount: 1,
  },
  {
    title: "Soft Deleted Thought B",
    body: "Another deleted thought for testing edge cases.",
    daysAgo: 21,
    hoursOffset: 0,
    deleted: true,
    noCategory: true,
  },
  {
    title: "Soft Deleted Thought C",
    body: "Third deleted thought with multiple categories.",
    daysAgo: 22,
    hoursOffset: 0,
    deleted: true,
    categoryCount: 3,
  },
  {
    title: "Soft Deleted Insight",
    body: "This insight is deleted.",
    daysAgo: 15,
    hoursOffset: 0,
    deleted: true,
    categoryCount: 1,
  },
  {
    title: "Unconnected Node",
    body: "This thought has no wiki links and no categories. It is an island.",
    daysAgo: 30,
    hoursOffset: 0,
    noCategory: true,
  },
  {
    title: "Insight Without Category",
    body: "An insight that belongs to no category. Testing the zero-association case.",
    daysAgo: 12,
    hoursOffset: 0,
    noCategory: true,
  },
  {
    body: "Untitled idea: sometimes raw notes are enough without a formal title.",
    daysAgo: 0,
    hoursOffset: 1,
    categoryCount: 1,
  },
  {
    body: "Untitled insight: sometimes raw notes are enough without a formal title.",
    daysAgo: 11,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Empty Body Thought",
    body: "",
    daysAgo: 16,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Very Old Thought",
    body: "This is from the beginning of the knowledge base. Just a placeholder with minimal content.",
    daysAgo: 300,
    hoursOffset: 0,
    categoryCount: 1,
  },
  {
    title: "Future Thought",
    body: "Dated slightly in the future to test sorting edge cases.",
    daysAgo: -1,
    hoursOffset: 0,
    categoryCount: 1,
  },
];

// ---------------------------------------------------------------------------
// Generated thoughts (bulk)
// ---------------------------------------------------------------------------

const TOTAL_THOUGHTS = 200;
const generatedThoughts: typeof anchorThoughts = [];

for (let i = 0; i < TOTAL_THOUGHTS - anchorThoughts.length; i++) {
  const titleKind = i % 3 === 0 ? "insight" : "idea";
  const daysAgo = rng.int(0, 365);
  const hoursOffset = rng.int(0, 23);

  // 5% chance of no title
  const noTitle = rng.bool(0.05);
  // 3% chance of empty body
  const emptyBody = rng.bool(0.03);
  // 8% chance of no category
  const noCategory = rng.bool(0.08);
  // 5% chance of deleted
  const deleted = rng.bool(0.05);
  // 30% chance of wiki link
  const hasWikiLink = rng.bool(0.3);

  const title = noTitle ? undefined : generateTitle(titleKind, i);
  const body = emptyBody ? "" : generateBody(i, hasWikiLink);

  generatedThoughts.push({
    title,
    body,
    daysAgo,
    hoursOffset,
    deleted,
    noCategory,
    categoryCount: noCategory ? undefined : rng.int(1, 3),
  });
}

const allThoughtTemplates = [...anchorThoughts, ...generatedThoughts];

type ThoughtSeed = (typeof allThoughtTemplates)[number] & {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const thoughtSeeds: ThoughtSeed[] = allThoughtTemplates.map((t) => ({
  ...t,
  id: generateId("th"),
  createdAt: isoDate(t.daysAgo, (t.hoursOffset ?? 0) + 1),
  updatedAt: isoDate(t.daysAgo, t.hoursOffset ?? 0),
  deletedAt: t.deleted ? isoDate(t.daysAgo, (t.hoursOffset ?? 0) - 1) : null,
}));

const insertThought = db.prepare(
  "INSERT INTO thoughts (id, title, body, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)",
);
for (const t of thoughtSeeds) {
  insertThought.run(t.id, t.title ?? null, t.body, t.createdAt, t.updatedAt, t.deletedAt);
}
console.log(`Inserted ${thoughtSeeds.length} thoughts`);

const activeThoughtIds = thoughtSeeds.filter((t) => !t.deleted).map((t) => t.id);
// deleted thoughts are tracked implicitly

// ---------------------------------------------------------------------------
// Thought-Categories associations
// ---------------------------------------------------------------------------

const insertTC = db.prepare(
  "INSERT INTO thought_categories (thought_id, category_id) VALUES (?, ?)",
);
let tcCount = 0;

for (const t of thoughtSeeds) {
  if (t.noCategory) continue;
  const count = t.categoryCount ?? rng.int(1, 3);
  // Bias toward leaf categories but allow any
  const pool = rng.bool(0.6) ? allCategoryIds : leafCategoryIds;
  const cats = rng.pickUnique(pool, count);
  for (const catId of cats) {
    insertTC.run(t.id, catId);
    tcCount++;
  }
}
console.log(`Inserted ${tcCount} thought-category links`);

// ---------------------------------------------------------------------------
// Thought-Connections (via wiki-link resolution)
// ---------------------------------------------------------------------------

const insertConn = db.prepare(
  "INSERT INTO thought_connections (source_id, target_id) VALUES (?, ?)",
);
const connectionSet = new Set<string>();
let connCount = 0;

for (const t of thoughtSeeds) {
  if (t.deleted) continue;
  const matches = t.body.matchAll(/\[\[(.+?)\]\]/g);
  for (const match of matches) {
    const linkTitle = match[1];
    const target = thoughtSeeds.find((x) => x.title === linkTitle && !x.deleted);
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
  const source = rng.pick(activeThoughtIds);
  const target = rng.pick(activeThoughtIds);
  if (source !== target) {
    const key = `${source}->${target}`;
    if (!connectionSet.has(key)) {
      connectionSet.add(key);
      insertConn.run(source, target);
      connCount++;
    }
  }
}

console.log(`Inserted ${connCount} thought connections`);

// ---------------------------------------------------------------------------
// Contexts (varied source types, names, deletion states)
// ---------------------------------------------------------------------------

const sourceTypes = [
  "code",
  "note",
  "bookmark",
  "article",
  "conversation",
  "documentation",
  "video",
  "podcast",
];

const contextTemplates = [
  {
    sourceType: "code",
    sourceName: "github.com/vercel/next.js",
    content:
      "Next.js App Router implementation details. The layout.tsx file handles nested routing.",
  },
  {
    sourceType: "note",
    sourceName: "Meeting Notes 2024-03",
    content: "Discussed migration strategy from Pages Router to App Router. Estimated 3 sprints.",
  },
  {
    sourceType: "bookmark",
    sourceName: "React Docs",
    content: "https://react.dev/reference/react/Suspense - Official Suspense documentation",
  },
  {
    sourceType: "article",
    sourceName: "Kent C. Dodds Blog",
    content: "Why I love React Server Components and how they change the data fetching paradigm.",
  },
  {
    sourceType: "conversation",
    sourceName: "Slack #frontend",
    content: "Team agreed to adopt RSC for new features but keep existing pages as-is.",
  },
  {
    sourceType: "code",
    sourceName: "src/components/Modal.tsx",
    content:
      "Modal component using React Portal and focus trap. Accessibility considerations included.",
  },
  {
    sourceType: "documentation",
    sourceName: "Drizzle ORM Docs",
    content: "Drizzle uses relational syntax for queries. Much closer to SQL than Prisma.",
  },
  {
    sourceType: "video",
    sourceName: "YouTube: System Design Interview",
    content: "Key takeaways: caching layers, CDN, database read replicas, and message queues.",
  },
  {
    sourceType: "podcast",
    sourceName: "Backend Engineering Show",
    content: "Episode on API versioning strategies. URL versioning vs header versioning debate.",
  },
  {
    sourceType: "note",
    sourceName: null,
    content: "Random idea: what if we used CRDTs for real-time collaborative editing?",
  },
  {
    sourceType: "bookmark",
    sourceName: "Hacker News",
    content:
      "Top post about a new Rust web framework. Interesting benchmarks against Axum and Actix.",
  },
  {
    sourceType: "article",
    sourceName: "ACM Queue",
    content: "Paper on distributed consensus. Paxos vs Raft vs ZAB compared empirically.",
  },
  {
    sourceType: "code",
    sourceName: "Dockerfile",
    content: "Multi-stage build reducing image size from 800MB to 45MB.",
  },
  {
    sourceType: "conversation",
    sourceName: "1:1 with Manager",
    content: "Career goals discussion. Want to focus more on system design and architecture.",
  },
  {
    sourceType: "note",
    sourceName: "Daily Journal",
    content: "Read 30 pages of 'Designing Data-Intensive Applications'. Chapter on replication.",
  },
  {
    sourceType: "bookmark",
    sourceName: "MDN Web Docs",
    content: "Container queries now supported in all major browsers. Time to refactor components.",
  },
  {
    sourceType: "article",
    sourceName: "Vercel Engineering Blog",
    content: "How Vercel handles millions of deploys per day. Edge functions and caching strategy.",
  },
  {
    sourceType: "video",
    sourceName: "Confreaks: React Conf 2024",
    content:
      "New React compiler optimizes re-renders automatically. No more useMemo in most cases.",
  },
  {
    sourceType: "code",
    sourceName: "benchmark.rs",
    content: "Benchmark results: 50k req/s on a single core. Memory usage stable at 12MB.",
  },
  {
    sourceType: "documentation",
    sourceName: "OpenAPI Spec",
    content: "Version 3.1 spec for the public API. Need to add webhook definitions.",
  },
];

const insertContext = db.prepare(
  "INSERT INTO contexts (id, thought_id, source_type, source_name, content, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
let ctxCount = 0;

// Insert template contexts
for (let i = 0; i < contextTemplates.length * 2; i++) {
  const tpl = contextTemplates[i % contextTemplates.length];
  const thoughtId = activeThoughtIds[i % activeThoughtIds.length];
  insertContext.run(
    generateId("ctx"),
    thoughtId,
    tpl.sourceType,
    tpl.sourceName,
    `${tpl.content} (variant ${i})`,
    isoDate(rng.int(0, 100), rng.int(0, 23)),
    null,
  );
  ctxCount++;
}

// Generate random contexts for thoughts
for (const thoughtId of activeThoughtIds) {
  const numContexts = rng.int(0, 4);
  for (let i = 0; i < numContexts; i++) {
    const type = rng.pick(sourceTypes);
    const hasName = rng.bool(0.7);
    const name = hasName ? `${type}-source-${rng.int(1, 999)}` : null;
    const paragraphs = rng.int(1, 5);
    const content = Array(paragraphs)
      .fill(0)
      .map((_, j) => `Paragraph ${j + 1}: ${generateBody(rng.int(0, 999), false)}`)
      .join("\n\n");
    insertContext.run(
      generateId("ctx"),
      thoughtId,
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
  const thoughtId = rng.pick(activeThoughtIds);
  insertContext.run(
    generateId("ctx"),
    thoughtId,
    rng.pick(sourceTypes),
    `Deleted Source ${i}`,
    `This context is soft-deleted. Content number ${i}.`,
    isoDate(50, 0),
    isoDate(40, 0),
  );
  ctxCount++;
}

console.log(`Inserted ${ctxCount} contexts`);

// ---------------------------------------------------------------------------
// FTS5 population
// ---------------------------------------------------------------------------

const insertFtsThought = db.prepare(
  "INSERT INTO fts_thoughts (thought_id, title, body) VALUES (?, ?, ?)",
);
for (const t of thoughtSeeds) {
  if (t.deleted) continue;
  insertFtsThought.run(t.id, t.title ?? "", t.body);
}
console.log("Populated fts_thoughts");

const insertFtsContext = db.prepare(
  "INSERT INTO fts_contexts (context_id, thought_id, source_name, content) VALUES (?, ?, ?, ?)",
);
const activeContextRows = db
  .query("SELECT id, thought_id, source_name, content FROM contexts WHERE deleted_at IS NULL")
  .all() as Array<{
  id: string;
  thought_id: string;
  source_name: string | null;
  content: string;
}>;
for (const c of activeContextRows) {
  insertFtsContext.run(c.id, c.thought_id, c.source_name, c.content);
}
console.log("Populated fts_contexts");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const catCount = (db.query("SELECT count(*) AS c FROM categories").get() as { c: number }).c;
const thoughtCount = (db.query("SELECT count(*) AS c FROM thoughts").get() as { c: number }).c;
const activeThoughtCount = (
  db.query("SELECT count(*) AS c FROM thoughts WHERE deleted_at IS NULL").get() as { c: number }
).c;
const deletedThoughtCount = (
  db.query("SELECT count(*) AS c FROM thoughts WHERE deleted_at IS NOT NULL").get() as { c: number }
).c;
const connectionCount = (
  db.query("SELECT count(*) AS c FROM thought_connections").get() as { c: number }
).c;
const contextTotal = (db.query("SELECT count(*) AS c FROM contexts").get() as { c: number }).c;
const activeCtxCount = (
  db.query("SELECT count(*) AS c FROM contexts WHERE deleted_at IS NULL").get() as { c: number }
).c;
const deletedCtxCount = (
  db.query("SELECT count(*) AS c FROM contexts WHERE deleted_at IS NOT NULL").get() as { c: number }
).c;

console.log("\n✅ Seed complete! Summary:");
console.log(`   Categories:        ${catCount}`);
console.log(
  `   Thoughts:          ${thoughtCount} (active: ${activeThoughtCount}, deleted: ${deletedThoughtCount})`,
);
console.log(`   Connections:       ${connectionCount}`);
console.log(
  `   Contexts:          ${contextTotal} (active: ${activeCtxCount}, deleted: ${deletedCtxCount})`,
);
console.log(`   Database:          ${dbPath}`);

const findThought = (title: string) => thoughtSeeds.find((t) => t.title === title);

console.log("\n📌 Sample IDs for testing:");
console.log(`   Category (root):   ${categories[0].id}`);
console.log(`   Category (L2):     ${categories[5].id}`);
console.log(`   Category (L3):     ${categories[13].id}`);
console.log(`   Thought (idea):    ${findThought("React Server Components")?.id}`);
console.log(`   Thought (insight): ${findThought("Bidirectional Link A")?.id}`);
console.log(`   Thought (deleted): ${findThought("Soft Deleted Thought A")?.id}`);
console.log(`   Thought (no cat):  ${findThought("Unconnected Node")?.id}`);
console.log(`   Thought (path):    ${findThought("Long Path Start")?.id}`);
console.log(`   Thought (cycle):   ${findThought("Circular A")?.id}`);
console.log(`   Thought (star):    ${findThought("Star Center")?.id}`);
console.log(`   Thought (search):  ${findThought("Search Test Alpha")?.id}`);
const deletedCtxSample = db
  .query("SELECT id FROM contexts WHERE deleted_at IS NOT NULL LIMIT 1")
  .get() as { id: string } | undefined;
console.log(`   Context (deleted): ${deletedCtxSample?.id ?? "none"}`);

db.close();
