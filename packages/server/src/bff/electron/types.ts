import type { ReflectaDb } from "../../db/types";
export type { ReflectaDb };

export type ReflectaServerContext = {
  getDb: () => ReflectaDb;
};
