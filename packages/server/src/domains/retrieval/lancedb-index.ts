import * as lancedb from "@lancedb/lancedb";
import type {
  EmbeddingProvider,
  RetrievalChannel,
  RetrievalDocument,
  RetrievalSearchHit,
} from "./types";

type LanceDbRetrievalIndexOptions = {
  uri: string;
  embeddingProvider: EmbeddingProvider;
  tableName?: string;
};

type ReplaceAllOptions = {
  onEmbeddingProgress?: (progress: { completed: number; total: number }) => void;
  onWritingStart?: () => void;
};

type RetrievalIndexSearchOptions = {
  includeDense?: boolean;
};

type RetrievalRow = {
  id: string;
  entityType: string;
  entityId: string;
  parentUnderstandingId: string;
  textForEmbedding: string;
  textForLexicalSearch: string;
  domainIdsJson: string;
  domainNamesJson: string;
  medium: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  vector: number[];
  _distance?: number;
  _relevance_score?: number;
  _score?: number;
  _channels?: RetrievalChannel[];
};

const SEMANTIC_DISTANCE_THRESHOLD = 0.35;
const RRF_K = 60;

function lexicalFtsIndex() {
  return lancedb.Index.fts({
    baseTokenizer: "ngram",
    ngramMinLength: 2,
    ngramMaxLength: 5,
    prefixOnly: false,
    withPosition: false,
  });
}

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function toRow(doc: RetrievalDocument, vector: number[]): RetrievalRow {
  return {
    id: doc.id,
    entityType: doc.entityType,
    entityId: doc.entityId,
    parentUnderstandingId: doc.parentUnderstandingId,
    textForEmbedding: doc.textForEmbedding,
    textForLexicalSearch: doc.textForLexicalSearch,
    domainIdsJson: JSON.stringify(doc.metadata.domainIds),
    domainNamesJson: JSON.stringify(doc.metadata.domainNames),
    medium: doc.metadata.medium ?? "",
    title: doc.metadata.title ?? "",
    createdAt: doc.metadata.createdAt ?? "",
    updatedAt: doc.metadata.updatedAt ?? "",
    vector,
  };
}

function fromRow(row: RetrievalRow): RetrievalSearchHit {
  return {
    id: row.id,
    entityType: row.entityType as RetrievalSearchHit["entityType"],
    entityId: row.entityId,
    parentUnderstandingId: row.parentUnderstandingId,
    textForEmbedding: row.textForEmbedding,
    textForLexicalSearch: row.textForLexicalSearch,
    score: row._relevance_score ?? row._score ?? (row._distance === undefined ? 0 : -row._distance),
    denseDistance: row._distance,
    channels: row._channels ?? (row._distance === undefined ? ["lexical"] : ["dense"]),
    metadata: {
      domainIds: JSON.parse(row.domainIdsJson) as string[],
      domainNames: JSON.parse(row.domainNamesJson) as string[],
      medium: row.medium || undefined,
      title: row.title || null,
      createdAt: row.createdAt || undefined,
      updatedAt: row.updatedAt || undefined,
    },
  };
}

function isRelevantRow(row: RetrievalRow): boolean {
  const semanticDistance = row._distance ?? Number.POSITIVE_INFINITY;
  return semanticDistance <= SEMANTIC_DISTANCE_THRESHOLD;
}

function lexicalTokens(query: string): string[] {
  return query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function matchesLexicalQuery(row: RetrievalRow, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const text = row.textForLexicalSearch.toLocaleLowerCase();
  return tokens.every((token) => text.includes(token));
}

function hasVectorSignal(vector: number[]): boolean {
  return Math.hypot(...vector) > 0;
}

function fuseRows(lexicalRows: RetrievalRow[], semanticRows: RetrievalRow[], limit: number) {
  const byId = new Map<
    string,
    { row: RetrievalRow; score: number; channels: Set<RetrievalChannel>; denseDistance?: number }
  >();

  function addRows(rows: RetrievalRow[], channel: RetrievalChannel) {
    rows.forEach((row, index) => {
      const item = byId.get(row.id) ?? {
        row,
        score: 0,
        channels: new Set<RetrievalChannel>(),
      };
      item.score += 1 / (RRF_K + index + 1);
      item.channels.add(channel);
      if (row._distance !== undefined) item.denseDistance = row._distance;
      byId.set(row.id, item);
    });
  }

  addRows(lexicalRows, "lexical");
  addRows(semanticRows, "dense");

  return [...byId.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.row,
      _distance: item.denseDistance,
      _relevance_score: item.score,
      _channels: [...item.channels],
    }));
}

export class LanceDbRetrievalIndex {
  private readonly tableName: string;

  constructor(private readonly options: LanceDbRetrievalIndexOptions) {
    this.tableName = options.tableName ?? "retrieval_documents";
  }

  async isReady(): Promise<boolean> {
    const db = await lancedb.connect(this.options.uri);
    return (await db.tableNames()).includes(this.tableName);
  }

  async replaceAll(docs: RetrievalDocument[], options?: ReplaceAllOptions): Promise<void> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (tableNames.includes(this.tableName)) {
      await db.dropTable(this.tableName);
    }
    if (docs.length === 0) return;

    const rows = await this.embedRows(docs, options);
    options?.onWritingStart?.();
    const table = await db.createTable(this.tableName, rows);
    await table.createIndex("textForLexicalSearch", { config: lexicalFtsIndex() });
  }

  async syncByUnderstandingId(
    parentUnderstandingId: string,
    docs: RetrievalDocument[],
  ): Promise<void> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      await this.replaceAll(docs);
      return;
    }

    const table = await db.openTable(this.tableName);
    await table.delete(`parentUnderstandingId = ${quoteSqlString(parentUnderstandingId)}`);
    if (docs.length > 0) {
      await table.add(await this.embedRows(docs));
      await table.createIndex("textForLexicalSearch", { config: lexicalFtsIndex() });
    }
  }

  async search(
    query: string,
    limit = 20,
    options: RetrievalIndexSearchOptions = {},
  ): Promise<RetrievalSearchHit[]> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(this.tableName)) return [];

    const table = await db.openTable(this.tableName);
    const searchLimit = Math.max(limit * 5, 20);
    const tokens = lexicalTokens(query);
    const lexicalRows = (
      (await table
        .search(query)
        .fullTextSearch(query, { columns: ["textForLexicalSearch"] })
        .limit(searchLimit)
        .toArray()) as RetrievalRow[]
    )
      .filter((row) => matchesLexicalQuery(row, tokens))
      .slice(0, limit);
    const [vector] =
      options.includeDense === false ? [[0]] : await this.options.embeddingProvider.embed([query]);
    const semanticRows =
      options.includeDense !== false && hasVectorSignal(vector)
        ? (
            (await table.vectorSearch(vector).limit(searchLimit).toArray()) as RetrievalRow[]
          ).filter(isRelevantRow)
        : [];
    return fuseRows(lexicalRows, semanticRows, limit).map(fromRow);
  }

  private async embedRows(
    docs: RetrievalDocument[],
    options?: ReplaceAllOptions,
  ): Promise<RetrievalRow[]> {
    const vectors = await this.options.embeddingProvider.embed(
      docs.map((doc) => doc.textForEmbedding),
      { onProgress: options?.onEmbeddingProgress },
    );
    return docs.map((doc, index) => toRow(doc, vectors[index]));
  }
}
