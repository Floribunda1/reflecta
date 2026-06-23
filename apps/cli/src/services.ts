import {
  DomainCliBff,
  ContextCliBff,
  GraphCliBff,
  SearchCliBff,
  UnderstandingCliBff,
} from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  domains: DomainCliBff;
  contexts: ContextCliBff;
  graph: GraphCliBff;
  search: SearchCliBff;
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
    understandings: new UnderstandingCliBff(db),
  };

  return services;
}
