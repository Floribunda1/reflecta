#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { getDbPath, initDB } from "./db.js";
import {
  searchThoughts,
  getThoughtById,
  listCategories,
  listRecentThoughts,
  searchContexts,
} from "./tools.js";

const server = new Server(
  {
    name: "reflecta-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_thoughts",
        description:
          "Full-text search over Reflecta thoughts using SQLite FTS. Returns matching thoughts with categories and contexts.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "FTS query string (supports AND, OR, NEAR, prefix wildcards, etc.)",
            },
            limit: {
              type: "number",
              description: "Max results to return (default 20)",
              default: 20,
            },
            offset: {
              type: "number",
              description: "Result offset for pagination (default 0)",
              default: 0,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_thought",
        description:
          "Get a single thought by ID, including its categories, contexts, connections and referenced-by thoughts.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Thought ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "list_categories",
        description: "List all categories in Reflecta.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_recent_thoughts",
        description: "List recently updated thoughts ordered by updatedAt descending.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Max results to return (default 20)",
              default: 20,
            },
          },
        },
      },
      {
        name: "search_contexts",
        description:
          "Full-text search over Reflecta context source names and content using SQLite FTS. Returns matching contexts with snippet highlights.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "FTS query string",
            },
            limit: {
              type: "number",
              description: "Max results to return (default 20)",
              default: 20,
            },
            offset: {
              type: "number",
              description: "Result offset for pagination (default 0)",
              default: 0,
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: unknown;

  switch (name) {
    case "search_thoughts": {
      const q = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 20);
      const offset = Number(args?.offset ?? 0);
      result = await searchThoughts(q, limit, offset);
      break;
    }
    case "get_thought": {
      const id = String(args?.id ?? "");
      result = await getThoughtById(id);
      break;
    }
    case "list_categories": {
      result = await listCategories();
      break;
    }
    case "list_recent_thoughts": {
      const limit = Number(args?.limit ?? 20);
      result = await listRecentThoughts(limit);
      break;
    }
    case "search_contexts": {
      const q = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 20);
      const offset = Number(args?.offset ?? 0);
      result = await searchContexts(q, limit, offset);
      break;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  const content: TextContent[] = [
    {
      type: "text",
      text: JSON.stringify(result, null, 2),
    },
  ];

  return { content };
});

async function main() {
  // Validate DB path early and print to stderr so it appears in logs but not on stdout
  const dbPath = getDbPath();
  // eslint-disable-next-line no-console
  console.error(`[reflecta-mcp-server] Using database: ${dbPath}`);
  await initDB();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
