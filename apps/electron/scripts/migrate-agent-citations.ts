import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

type JsonObject = Record<string, unknown>;
type EntityType = "understanding" | "context" | "domain";
type Entity = { type: EntityType; id: string; title?: string };
type Origin =
  | { kind: "user_context"; messageId: string }
  | { kind: "tool_result"; toolCallId: string; toolName: string };
type CitationSource = { index: number; entity: Entity; origin?: Origin };

type SessionEntry = JsonObject & {
  type?: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  customType?: string;
  data?: JsonObject;
  message?: JsonObject;
};

type MigrationStats = {
  citationSourcesRemoved: number;
  numberedMarkersConverted: number;
  legacyMarkersConverted: number;
  refMarkersConverted: number;
  unmatchedNumberMarkers: number;
  blockTextsChanged: number;
  rawAssistantMessagesChanged: number;
  catalogEntriesAdded: number;
};

type ParsedFile = {
  filePath: string;
  name: string;
  original: string;
  entries: SessionEntry[];
  stat: { size: number; mtimeMs: number; mode: number };
};

export type FileMigrationPlan = ParsedFile & {
  updated: string;
  changed: boolean;
  stats: MigrationStats;
  errors: string[];
};

export type RootMigrationPlan = {
  root: string;
  sessionsDir: string;
  files: FileMigrationPlan[];
  errors: string[];
  totals: MigrationStats & { sessionsScanned: number; sessionsChanged: number };
};

const EMPTY_STATS = (): MigrationStats => ({
  citationSourcesRemoved: 0,
  numberedMarkersConverted: 0,
  legacyMarkersConverted: 0,
  refMarkersConverted: 0,
  unmatchedNumberMarkers: 0,
  blockTextsChanged: 0,
  rawAssistantMessagesChanged: 0,
  catalogEntriesAdded: 0,
});

const STAT_KEYS = Object.keys(EMPTY_STATS()) as (keyof MigrationStats)[];

const ENTITY_PREFIX: Record<EntityType, string> = {
  understanding: "u",
  context: "c",
  domain: "d",
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntity(value: unknown): Entity | undefined {
  if (!isObject(value)) return undefined;
  const type = value.type;
  const id = value.id;
  if (
    (type !== "understanding" && type !== "context" && type !== "domain") ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(id)
  ) {
    return undefined;
  }
  return {
    type,
    id,
    ...(typeof value.title === "string" && value.title.trim() ? { title: value.title } : {}),
  };
}

function parseOrigin(value: unknown): Origin | undefined {
  if (!isObject(value)) return undefined;
  if (value.kind === "user_context" && typeof value.messageId === "string") {
    return { kind: "user_context", messageId: value.messageId };
  }
  if (
    value.kind === "tool_result" &&
    typeof value.toolCallId === "string" &&
    typeof value.toolName === "string"
  ) {
    return { kind: "tool_result", toolCallId: value.toolCallId, toolName: value.toolName };
  }
  return undefined;
}

function parseCitationSources(
  value: unknown,
  location: string,
  errors: string[],
): CitationSource[] {
  if (!Array.isArray(value)) {
    errors.push(`${location}: citationSources is not an array`);
    return [];
  }
  return value.flatMap((source, index) => {
    if (!isObject(source) || !Number.isInteger(source.index) || Number(source.index) < 1) {
      errors.push(`${location}: invalid citation source at offset ${index}`);
      return [];
    }
    const entity = parseEntity(source.entity);
    if (!entity) {
      errors.push(`${location}: invalid citation entity at offset ${index}`);
      return [];
    }
    const origin = source.origin === undefined ? undefined : parseOrigin(source.origin);
    if (source.origin !== undefined && !origin) {
      errors.push(`${location}: invalid citation origin at offset ${index}`);
      return [];
    }
    return [{ index: Number(source.index), entity, ...(origin ? { origin } : {}) }];
  });
}

function entityKey(entity: Entity) {
  return `${entity.type}:${entity.id}`;
}

function directMarker(entity: Entity) {
  return `[[${ENTITY_PREFIX[entity.type]}:${entity.id}]]`;
}

type MarkdownResult = {
  text: string;
  numbered: number;
  legacy: number;
  refs: number;
  unmatchedNumbers: number;
  unresolvedIds: string[];
};

function migrateMarkdown(
  markdown: string,
  sourcesByIndex: Map<number, Entity>,
  entityTypesById: Map<string, EntityType>,
): MarkdownResult {
  const chunks: string[] = [];
  const unresolvedIds: string[] = [];
  let numbered = 0;
  let legacy = 0;
  let refs = 0;
  let unmatchedNumbers = 0;
  let index = 0;
  let inFence = false;
  let inInlineCode = false;

  while (index < markdown.length) {
    if (!inInlineCode && markdown.startsWith("```", index)) {
      inFence = !inFence;
      chunks.push("```");
      index += 3;
      continue;
    }

    const char = markdown[index];
    if (!inFence && char === "`") {
      inInlineCode = !inInlineCode;
      chunks.push(char);
      index += 1;
      continue;
    }

    if (!inFence && !inInlineCode && markdown.startsWith("[[", index)) {
      const close = markdown.indexOf("]]", index + 2);
      if (close >= 0) {
        const token = markdown.slice(index + 2, close);
        const refMatch = /^ref:([^|]+)(?:\|.*)?$/.exec(token);
        const hash = token.lastIndexOf("#");
        const id = refMatch?.[1] ?? (hash > 0 ? token.slice(hash + 1) : undefined);
        if (id) {
          const type = entityTypesById.get(id);
          if (type) {
            chunks.push(directMarker({ type, id }));
            if (refMatch) refs += 1;
            else legacy += 1;
            index = close + 2;
            continue;
          }
          unresolvedIds.push(id);
        }
      }
    }

    if (!inFence && !inInlineCode && char === "[") {
      const close = markdown.indexOf("]", index + 1);
      const previous = index > 0 ? markdown[index - 1] : "";
      const next = close >= 0 ? markdown[close + 1] : "";
      if (close > index + 1 && previous !== "!" && next !== "(") {
        const label = markdown.slice(index + 1, close);
        if (/^\d+$/.test(label)) {
          const source = sourcesByIndex.get(Number(label));
          if (source) {
            chunks.push(directMarker(source));
            numbered += 1;
            index = close + 1;
            continue;
          }
          unmatchedNumbers += 1;
        }
      }
    }

    chunks.push(char);
    index += 1;
  }

  return {
    text: chunks.join(""),
    numbered,
    legacy,
    refs,
    unmatchedNumbers,
    unresolvedIds,
  };
}

function parseSessionFile(filePath: string): ParsedFile {
  const original = readFileSync(filePath, "utf8");
  const lines = original.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.some((line) => !line.trim()))
    throw new Error(`${filePath}: contains a blank JSONL line`);
  const entries = lines.map((line, index) => {
    try {
      return JSON.parse(line) as SessionEntry;
    } catch (error) {
      throw new Error(`${filePath}:${index + 1}: ${String(error)}`);
    }
  });
  const fileStat = statSync(filePath);
  return {
    filePath,
    name: path.basename(filePath),
    original,
    entries,
    stat: { size: fileStat.size, mtimeMs: fileStat.mtimeMs, mode: fileStat.mode },
  };
}

function registerEntityType(
  entity: Entity,
  typesById: Map<string, EntityType>,
  location: string,
  errors: string[],
) {
  const existing = typesById.get(entity.id);
  if (existing && existing !== entity.type) {
    errors.push(`${location}: entity ${entity.id} has both ${existing} and ${entity.type}`);
    return;
  }
  typesById.set(entity.id, entity.type);
}

function rootEntityTypes(files: ParsedFile[], errors: string[]) {
  const typesById = new Map<string, EntityType>();
  for (const file of files) {
    for (const [lineIndex, entry] of file.entries.entries()) {
      const data = entry.data;
      if (!isObject(data)) continue;
      if (data.type === "assistant.turn" && "citationSources" in data) {
        for (const source of parseCitationSources(
          data.citationSources,
          `${file.name}:${lineIndex + 1}`,
          errors,
        )) {
          registerEntityType(source.entity, typesById, file.name, errors);
        }
      }
      if (data.type === "entity.catalog.updated" && Array.isArray(data.entries)) {
        for (const catalogEntry of data.entries) {
          const entity = isObject(catalogEntry) ? parseEntity(catalogEntry.entity) : undefined;
          if (entity) registerEntityType(entity, typesById, file.name, errors);
        }
      }
    }
  }
  return typesById;
}

function migrationId(sessionId: string) {
  return createHash("sha256").update(`agent-citation-migration:${sessionId}`).digest("hex");
}

function migrateSessionFile(
  parsed: ParsedFile,
  entityTypesById: Map<string, EntityType>,
): FileMigrationPlan {
  const entries = structuredClone(parsed.entries);
  const stats = EMPTY_STATS();
  const errors: string[] = [];
  const entriesById = new Map(entries.flatMap((entry) => (entry.id ? [[entry.id, entry]] : [])));
  const userMessageByRun = new Map<string, string>();
  let firstUserMessageId: string | undefined;
  const existingCatalog = new Set<string>();
  let lastCatalogData: JsonObject | undefined;
  const sourcesByKey = new Map<
    string,
    { entity: Entity; origin?: Origin; fallbackMessageId?: string }
  >();

  for (const entry of entries) {
    const data = entry.data;
    if (!isObject(data)) continue;
    if (
      data.type === "user.message" &&
      typeof data.messageId === "string" &&
      typeof data.runId === "string"
    ) {
      userMessageByRun.set(data.runId, data.messageId);
      firstUserMessageId ??= data.messageId;
    }
    if (data.type === "entity.catalog.updated" && Array.isArray(data.entries)) {
      lastCatalogData = data;
      for (const catalogEntry of data.entries) {
        const entity = isObject(catalogEntry) ? parseEntity(catalogEntry.entity) : undefined;
        if (entity) existingCatalog.add(entityKey(entity));
      }
    }
  }

  for (const [lineIndex, entry] of entries.entries()) {
    const data = entry.data;
    if (!isObject(data) || data.type !== "assistant.turn") continue;
    const location = `${parsed.name}:${lineIndex + 1}`;
    const sources =
      "citationSources" in data ? parseCitationSources(data.citationSources, location, errors) : [];
    const sourcesByIndex = new Map<number, Entity>();
    const fallbackMessageId =
      typeof data.runId === "string" ? userMessageByRun.get(data.runId) : firstUserMessageId;

    for (const source of sources) {
      const prior = sourcesByIndex.get(source.index);
      if (prior && entityKey(prior) !== entityKey(source.entity)) {
        errors.push(`${location}: citation index ${source.index} maps to multiple entities`);
        continue;
      }
      sourcesByIndex.set(source.index, source.entity);
      const key = entityKey(source.entity);
      const known = sourcesByKey.get(key);
      sourcesByKey.set(key, {
        entity: source.entity.title ? source.entity : (known?.entity ?? source.entity),
        origin: source.origin ?? known?.origin,
        fallbackMessageId: fallbackMessageId ?? known?.fallbackMessageId,
      });
    }

    if (typeof data.text === "string") {
      const result = migrateMarkdown(data.text, sourcesByIndex, entityTypesById);
      data.text = result.text;
      stats.numberedMarkersConverted += result.numbered;
      stats.legacyMarkersConverted += result.legacy;
      stats.refMarkersConverted += result.refs;
      stats.unmatchedNumberMarkers += result.unmatchedNumbers;
      for (const id of result.unresolvedIds)
        errors.push(`${location}: cannot resolve type for ${id}`);
    }

    if (Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (!isObject(block) || block.kind !== "text" || typeof block.text !== "string") continue;
        const result = migrateMarkdown(block.text, sourcesByIndex, entityTypesById);
        if (result.text !== block.text) {
          block.text = result.text;
          stats.blockTextsChanged += 1;
        }
        for (const id of result.unresolvedIds)
          errors.push(`${location}: cannot resolve type for ${id}`);
      }
    }

    const visited = new Set<string>();
    let parentId = entry.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = entriesById.get(parentId);
      if (!parent) break;
      const parentData = parent.data;
      if (
        isObject(parentData) &&
        parentData.type === "run.started" &&
        parentData.runId === data.runId
      ) {
        break;
      }
      if (isObject(parent.message) && parent.message.role === "assistant") {
        const content = parent.message.content;
        let changed = false;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (!isObject(part) || part.type !== "text" || typeof part.text !== "string") continue;
            const result = migrateMarkdown(part.text, sourcesByIndex, entityTypesById);
            if (result.text !== part.text) {
              part.text = result.text;
              changed = true;
            }
            for (const id of result.unresolvedIds) {
              errors.push(`${location}: cannot resolve type for ${id}`);
            }
          }
        }
        if (changed) stats.rawAssistantMessagesChanged += 1;
      }
      parentId = parent.parentId;
    }

    if ("citationSources" in data) {
      delete data.citationSources;
      stats.citationSourcesRemoved += 1;
    }
  }

  const catalogEntries = [...sourcesByKey.entries()].flatMap(([key, source]) => {
    if (existingCatalog.has(key)) return [];
    const origin =
      source.origin ??
      (source.fallbackMessageId
        ? ({ kind: "user_context", messageId: source.fallbackMessageId } as const)
        : undefined);
    if (!origin) {
      errors.push(`${parsed.name}: cannot reconstruct catalog origin for ${key}`);
      return [];
    }
    return [{ key, entity: source.entity, origin }];
  });

  if (catalogEntries.length > 0) {
    if (lastCatalogData && Array.isArray(lastCatalogData.entries)) {
      lastCatalogData.entries.push(...catalogEntries);
      stats.catalogEntriesAdded = catalogEntries.length;
    } else {
      const sessionId = entries
        .map((entry) => entry.data?.sessionId)
        .find((value): value is string => typeof value === "string");
      const lastEntry = entries.at(-1);
      if (!sessionId || !lastEntry?.id) {
        errors.push(`${parsed.name}: cannot append reconstructed entity catalog`);
      } else {
        const digest = migrationId(sessionId);
        const id = digest.slice(0, 8);
        if (entriesById.has(id)) {
          errors.push(`${parsed.name}: deterministic migration entry id already exists`);
        } else {
          const createdAt =
            (typeof lastEntry.data?.createdAt === "string" && lastEntry.data.createdAt) ||
            lastEntry.timestamp ||
            new Date(0).toISOString();
          entries.push({
            type: "custom",
            customType: "reflecta.agent.event",
            id,
            parentId: lastEntry.id,
            timestamp: createdAt,
            data: {
              type: "entity.catalog.updated",
              sessionId,
              id: `evt_migration_${digest.slice(8, 29)}`,
              createdAt,
              entries: catalogEntries,
            },
          });
          stats.catalogEntriesAdded = catalogEntries.length;
        }
      }
    }
  }

  const updated = entries.length
    ? `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`
    : "";
  return { ...parsed, updated, changed: updated !== parsed.original, stats, errors };
}

function addStats(target: MigrationStats, source: MigrationStats) {
  for (const key of STAT_KEYS) target[key] += source[key];
}

export function scanRoot(contentRoot: string): RootMigrationPlan {
  const root = realpathSync(path.resolve(contentRoot));
  const sessionsDir = path.join(root, "Sessions");
  if (!existsSync(sessionsDir) || !lstatSync(sessionsDir).isDirectory()) {
    throw new Error(`${root}: Sessions directory not found`);
  }
  const parsedFiles = readdirSync(sessionsDir)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .map((name) => parseSessionFile(path.join(sessionsDir, name)));
  const errors: string[] = [];
  const entityTypesById = rootEntityTypes(parsedFiles, errors);
  const files = parsedFiles.map((file) => migrateSessionFile(file, entityTypesById));
  errors.push(...files.flatMap((file) => file.errors));
  const totals = {
    ...EMPTY_STATS(),
    sessionsScanned: files.length,
    sessionsChanged: files.filter((file) => file.changed).length,
  };
  for (const file of files) addStats(totals, file.stats);
  return { root, sessionsDir, files, errors: [...new Set(errors)], totals };
}

function assertUnchanged(file: FileMigrationPlan) {
  const current = statSync(file.filePath);
  if (current.size !== file.stat.size || current.mtimeMs !== file.stat.mtimeMs) {
    throw new Error(`${file.filePath}: changed after scan; close Reflecta and retry`);
  }
}

function atomicWrite(filePath: string, content: string, mode: number) {
  const temporary = `${filePath}.citation-migration-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(temporary, content, { encoding: "utf8", mode });
    renameSync(temporary, filePath);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function applyMigration(
  plans: RootMigrationPlan[],
  timestamp = new Date().toISOString().replace(/[:.]/g, "-"),
) {
  const errors = plans.flatMap((plan) => plan.errors);
  if (errors.length) throw new Error(`Migration preflight failed:\n${errors.join("\n")}`);
  const changedFiles = plans.flatMap((plan) => plan.files.filter((file) => file.changed));
  for (const file of changedFiles) assertUnchanged(file);

  const backupDirs = new Map<string, string>();
  for (const plan of plans) {
    const changed = plan.files.filter((file) => file.changed);
    if (!changed.length) continue;
    const backupDir = path.join(plan.root, `Sessions.citation-backup-${timestamp}`);
    if (existsSync(backupDir)) throw new Error(`${backupDir}: backup directory already exists`);
    mkdirSync(backupDir);
    for (const file of changed) copyFileSync(file.filePath, path.join(backupDir, file.name));
    backupDirs.set(plan.root, backupDir);
  }

  const written: FileMigrationPlan[] = [];
  try {
    for (const file of changedFiles) {
      assertUnchanged(file);
      atomicWrite(file.filePath, file.updated, file.stat.mode);
      written.push(file);
    }
  } catch (error) {
    for (const file of written.reverse()) atomicWrite(file.filePath, file.original, file.stat.mode);
    throw error;
  }
  return backupDirs;
}

function printPlan(plan: RootMigrationPlan) {
  const t = plan.totals;
  console.log(`\n${plan.root}`);
  console.log(`  sessions: ${t.sessionsScanned} scanned, ${t.sessionsChanged} changed`);
  console.log(
    `  markers: ${t.numberedMarkersConverted} numbered, ${t.legacyMarkersConverted} title#id, ${t.refMarkersConverted} ref`,
  );
  console.log(
    `  records: ${t.citationSourcesRemoved} source maps removed, ${t.catalogEntriesAdded} catalog entries added`,
  );
  if (t.unmatchedNumberMarkers) {
    console.log(`  left unchanged: ${t.unmatchedNumberMarkers} bracketed numbers without a source`);
  }
  for (const error of plan.errors) console.error(`  ERROR: ${error}`);
}

function usage() {
  console.log(
    "Usage: bun run scripts/migrate-agent-citations.ts [--apply] <content-root> [content-root...]",
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const roots = [...new Set(args.filter((arg) => arg !== "--apply" && arg !== "--help"))];
  if (args.includes("--help") || roots.length === 0) {
    usage();
    process.exitCode = roots.length ? 0 : 1;
  } else {
    try {
      const plans = roots.map(scanRoot);
      for (const plan of plans) printPlan(plan);
      if (plans.some((plan) => plan.errors.length)) {
        process.exitCode = 1;
      } else if (apply) {
        const backups = applyMigration(plans);
        for (const [root, backup] of backups) console.log(`  backup ${root}: ${backup}`);
        console.log("\nMigration applied.");
      } else {
        console.log("\nDry run only. No files changed. Add --apply after closing Reflecta.");
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
