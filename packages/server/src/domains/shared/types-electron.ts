import type { ReflectaDb } from "../../db/types";

export type ReflectaServerContext = {
  getDb: () => ReflectaDb;
};
