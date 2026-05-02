import type { ReflectaDb } from "../core/types";

export type { ReflectaDb };

export type ReflectaServerContext = {
  getDb: () => ReflectaDb;
};
