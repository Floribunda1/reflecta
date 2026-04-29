import { afterEach, describe, expect, it, vi } from "vitest";
import { callAction, getActionHelp, listActions } from "./actions";
import { getResolvedDbPath, resolveDbPath } from "./db";

const readActionNames = [
  "search_thoughts",
  "get_thought",
  "list_recent_thoughts",
  "list_categories",
  "search_contexts",
];

const writeActionNames = [
  "create_thought",
  "update_thought",
  "delete_thought",
  "restore_thought",
  "create_category",
  "update_category",
  "delete_category",
  "reorder_categories",
  "create_context",
  "update_context",
  "delete_context",
  "restore_context",
  "add_thought_connection",
  "remove_thought_connection",
];

describe("Reflecta CLI actions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers the expected read and write actions", () => {
    const names = listActions().map((action) => action.name);

    expect(names).toEqual([...readActionNames, ...writeActionNames]);
  });

  it("marks every action with mutating metadata", () => {
    const actions = listActions();

    for (const name of readActionNames) {
      expect(actions.find((item) => item.name === name)?.mutates).toBe(false);
    }

    for (const name of writeActionNames) {
      expect(actions.find((item) => item.name === name)?.mutates).toBe(true);
    }
  });

  it("keeps list-actions as an index without input or output schemas", () => {
    const actions = listActions();

    expect(actions[0]).toEqual({
      name: "search_thoughts",
      description:
        "Full-text search Reflecta thoughts. Returns matching thoughts with categories, contexts, and connections.",
      mutates: false,
    });
    expect(actions[0]).not.toHaveProperty("inputSchema");
    expect(actions[0]).not.toHaveProperty("help");
  });

  it("requires confirm in every write action help", () => {
    for (const name of readActionNames) {
      expect(getActionHelp(name)?.input.required).not.toContain("confirm");
    }

    for (const name of writeActionNames) {
      const help = getActionHelp(name);
      expect(help?.input.required).toContain("confirm");
    }
  });

  it("returns compact per-action help without schemas", () => {
    const help = getActionHelp("search_thoughts");

    expect(help?.command).toContain("reflecta search_thoughts");
    expect(help?.input.required).toEqual(["query"]);
    expect(help?.input.optional).toEqual(["limit", "offset"]);
    expect(help?.input.example).toMatchObject({ query: "design" });
    expect(help?.input).not.toHaveProperty("schema");
    expect(help?.output).not.toHaveProperty("schema");
  });

  it("blocks mutating actions unless confirm is true", async () => {
    const result = await callAction("delete_thought", { id: "thought-1", confirm: false });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("returns structured errors for invalid arguments", async () => {
    const result = await callAction("search_thoughts", {});

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("INVALID_ARGUMENTS");
  });

  it("returns structured errors for unknown actions", async () => {
    const result = await callAction("missing_action", {});

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("UNKNOWN_ACTION");
  });

  it("prioritizes REFLECTA_DB_PATH when resolving the database path", () => {
    vi.stubEnv("REFLECTA_DB_PATH", "./tmp/reflecta.db");

    expect(resolveDbPath()).toMatch(/tmp\/reflecta\.db$/);
    expect(getResolvedDbPath()).toMatch(/tmp\/reflecta\.db$/);
  });
});
