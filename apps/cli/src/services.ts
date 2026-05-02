import {
  CategoryCliBff,
  ContextCliBff,
  GraphCliBff,
  SearchCliBff,
  SnapshotCliBff,
  ThoughtCliBff,
} from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  categories: CategoryCliBff;
  contexts: ContextCliBff;
  graph: GraphCliBff;
  search: SearchCliBff;
  snapshot: SnapshotCliBff;
  thoughts: ThoughtCliBff;
};

let services: ReflectaCliServices | undefined;

export async function getServices(): Promise<ReflectaCliServices> {
  if (services) return services;

  await initializeDb();

  const db = getDb();

  services = {
    categories: new CategoryCliBff(db),
    contexts: new ContextCliBff(db),
    graph: new GraphCliBff(db),
    search: new SearchCliBff(db),
    snapshot: new SnapshotCliBff(db),
    thoughts: new ThoughtCliBff(db),
  };

  return services;
}
