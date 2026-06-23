import {
  DomainCliBff,
  ContextCliBff,
  GraphCliBff,
  SearchCliBff,
  SnapshotCliBff,
  UnderstandingCliBff,
} from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  domains: DomainCliBff;
  contexts: ContextCliBff;
  graph: GraphCliBff;
  search: SearchCliBff;
  snapshot: SnapshotCliBff;
  understandings: UnderstandingCliBff;
};

let services: ReflectaCliServices | undefined;

export async function getServices(): Promise<ReflectaCliServices> {
  if (services) return services;

  await initializeDb();

  const db = getDb();

  services = {
    domains: new DomainCliBff(db),
    contexts: new ContextCliBff(db),
    graph: new GraphCliBff(db),
    search: new SearchCliBff(db),
    snapshot: new SnapshotCliBff(db),
    understandings: new UnderstandingCliBff(db),
  };

  return services;
}
