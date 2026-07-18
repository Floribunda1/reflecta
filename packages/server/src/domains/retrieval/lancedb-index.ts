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

type LanceDbConnection = Awaited<ReturnType<typeof lancedb.connect>>;
type LanceDbTable = Awaited<ReturnType<LanceDbConnection["openTable"]>>;

type ReplaceAllOptions = {
  onEmbeddingProgress?: (progress: { completed: number; total: number }) => void;
  onWritingStart?: () => void;
};

export type RetrievalIndexManifestEntry = {
  id: string;
  parentUnderstandingId: string;
  contentHash: string;
};

type RetrievalRow = {
  id: string;
  contentHash: string;
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

function parentPredicate(parentUnderstandingIds: string[]): string {
  return parentUnderstandingIds
    .map((id) => `parentUnderstandingId = ${quoteSqlString(id)}`)
    .join(" OR ");
}

function toRow(doc: RetrievalDocument, vector: number[]): RetrievalRow {
  return {
    id: doc.id,
    contentHash: doc.contentHash,
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
    contentHash: row.contentHash,
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

function semanticQueryText(query: string): string {
  const productTerms: string[] = [];
  if (/(?:经验|经历|上下文)/u.test(query)) productTerms.push("Context");
  if (/(?:理解|认知)/u.test(query)) productTerms.push("Understanding");
  const expandedQuery =
    productTerms.length === 0 ? query : `${query}\n${[...new Set(productTerms)].join(" ")}`;
  return `Instruct: Given a Reflecta user query, retrieve relevant personal knowledge documents.\nQuery: ${expandedQuery}`;
}

function lexicalTerms(query: string): string[] {
  return query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
}

function matchesAnyLexicalTerm(row: RetrievalRow, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const text = row.textForLexicalSearch.toLocaleLowerCase();
  return terms.some((term) => text.includes(term.toLocaleLowerCase()));
}

function exactLexicalStrength(row: RetrievalRow, terms: string[]): number {
  const text = row.textForLexicalSearch.toLocaleLowerCase();
  return terms.reduce((score, term) => {
    const normalized = term.toLocaleLowerCase();
    return text.includes(normalized) ? score + 1_000 + normalized.length : score;
  }, 0);
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
    const rows = await this.embedRows(docs, options);
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (rows.length === 0) {
      if (tableNames.includes(this.tableName)) {
        await (await db.openTable(this.tableName)).delete("true");
      }
      return;
    }

    options?.onWritingStart?.();
    const table = await db.createTable(this.tableName, rows, { mode: "overwrite" });
    await table.createIndex("textForLexicalSearch", { config: lexicalFtsIndex() });
  }

  async readManifest(): Promise<RetrievalIndexManifestEntry[] | null> {
    const table = await this.openTable();
    if (!table) return null;
    return (await table
      .query()
      .select(["id", "parentUnderstandingId", "contentHash"])
      .toArray()) as RetrievalIndexManifestEntry[];
  }

  async replaceUnderstandingDocuments(
    parentUnderstandingIds: string[],
    docs: RetrievalDocument[],
    options?: ReplaceAllOptions,
  ): Promise<void> {
    const uniqueParentIds = [...new Set(parentUnderstandingIds)];
    if (uniqueParentIds.length === 0) return;
    const table = await this.openTable();
    if (!table) throw new Error(`Retrieval table is not ready: ${this.tableName}`);

    const rows = await this.embedRows(docs, options);
    options?.onWritingStart?.();
    const predicate = parentPredicate(uniqueParentIds);
    if (rows.length === 0) {
      await table.delete(predicate);
      return;
    }

    await table
      .mergeInsert("id")
      .whenMatchedUpdateAll()
      .whenNotMatchedInsertAll()
      .whenNotMatchedBySourceDelete({ where: predicate })
      .execute(rows);
  }

  async optimize(): Promise<void> {
    const table = await this.openTable();
    if (table) await table.optimize();
  }

  async search(query: string, limit = 20): Promise<RetrievalSearchHit[]> {
    const table = await this.openTable();
    if (!table) return [];

    const searchLimit = Math.max(limit * 5, 20);
    const lexicalRowsPromise = this.searchLexicalRows(table, query, searchLimit);
    const semanticRowsPromise = this.options.embeddingProvider
      .embed([semanticQueryText(query)])
      .then(async ([vector]) =>
        hasVectorSignal(vector)
          ? ((await table
              .vectorSearch(vector)
              .distanceType("cosine")
              .limit(searchLimit)
              .toArray()) as RetrievalRow[])
          : [],
      );
    const [lexicalRows, semanticRows] = await Promise.all([
      lexicalRowsPromise,
      semanticRowsPromise,
    ]);
    return fuseRows(lexicalRows, semanticRows, limit).map(fromRow);
  }

  async searchLexical(query: string, limit = 20): Promise<RetrievalSearchHit[]> {
    const table = await this.openTable();
    if (!table) return [];

    return fuseRows(await this.searchLexicalRows(table, query, limit), [], limit).map(fromRow);
  }

  private async openTable(): Promise<LanceDbTable | null> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(this.tableName)) return null;
    return db.openTable(this.tableName);
  }

  private async searchLexicalRows(
    table: LanceDbTable,
    query: string,
    limit: number,
  ): Promise<RetrievalRow[]> {
    const searchLimit = Math.max(limit * 5, 20);
    const terms = lexicalTerms(query);
    if (terms.length === 0) return [];
    const matchQuery = new lancedb.BooleanQuery(
      terms.map((term) => [
        lancedb.Occur.Should,
        new lancedb.MatchQuery(term, "textForLexicalSearch", {
          operator: lancedb.Operator.And,
        }),
      ]),
    );
    const [ftsRows, currentRows] = await Promise.all([
      table.search(query).fullTextSearch(matchQuery).limit(searchLimit).toArray() as Promise<
        RetrievalRow[]
      >,
      table
        .query()
        .select([
          "id",
          "contentHash",
          "entityType",
          "entityId",
          "parentUnderstandingId",
          "textForEmbedding",
          "textForLexicalSearch",
          "domainIdsJson",
          "domainNamesJson",
          "medium",
          "title",
          "createdAt",
          "updatedAt",
        ])
        .toArray() as Promise<RetrievalRow[]>,
    ]);

    const ranked = ftsRows.filter((row) => matchesAnyLexicalTerm(row, terms));
    const rankedIds = new Set(ranked.map((row) => row.id));
    const currentOnly = currentRows
      .filter((row) => !rankedIds.has(row.id) && matchesAnyLexicalTerm(row, terms))
      .sort(
        (left, right) =>
          exactLexicalStrength(right, terms) - exactLexicalStrength(left, terms) ||
          left.id.localeCompare(right.id),
      );

    return [...ranked, ...currentOnly].slice(0, limit);
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
