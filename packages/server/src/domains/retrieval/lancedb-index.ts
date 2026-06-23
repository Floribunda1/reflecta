import * as lancedb from "@lancedb/lancedb";
import type { EmbeddingProvider, RetrievalDocument, RetrievalSearchHit } from "./types";

type LanceDbRetrievalIndexOptions = {
  uri: string;
  embeddingProvider: EmbeddingProvider;
  tableName?: string;
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
};

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

export class LanceDbRetrievalIndex {
  private readonly tableName: string;

  constructor(private readonly options: LanceDbRetrievalIndexOptions) {
    this.tableName = options.tableName ?? "retrieval_documents";
  }

  async replaceAll(docs: RetrievalDocument[]): Promise<void> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (tableNames.includes(this.tableName)) {
      await db.dropTable(this.tableName);
    }
    if (docs.length === 0) return;

    const rows = await this.embedRows(docs);
    const table = await db.createTable(this.tableName, rows);
    await table.createIndex("textForLexicalSearch", { config: lancedb.Index.fts() });
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
      await table.createIndex("textForLexicalSearch", { config: lancedb.Index.fts() });
    }
  }

  async search(query: string, limit = 20): Promise<RetrievalSearchHit[]> {
    const db = await lancedb.connect(this.options.uri);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(this.tableName)) return [];

    const table = await db.openTable(this.tableName);
    const [vector] = await this.options.embeddingProvider.embed([query]);
    const rows = (await table
      .search(vector, "auto")
      .fullTextSearch(query, { columns: ["textForLexicalSearch"] })
      .limit(limit)
      .toArray()) as RetrievalRow[];
    return rows.map(fromRow);
  }

  private async embedRows(docs: RetrievalDocument[]): Promise<RetrievalRow[]> {
    const vectors = await this.options.embeddingProvider.embed(
      docs.map((doc) => doc.textForEmbedding),
    );
    return docs.map((doc, index) => toRow(doc, vectors[index]));
  }
}
