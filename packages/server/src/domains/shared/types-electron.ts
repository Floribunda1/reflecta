import type { ReflectaDb } from "../../db/types";
import type { RetrievalIndexUpdateSink } from "./types";

export type ReflectaServerContext = {
  getDb: () => ReflectaDb;
  retrievalIndex: RetrievalIndexUpdateSink;
};
