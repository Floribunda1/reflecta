import { DomainCliBff, ContextCliBff, SearchCliBff, UnderstandingCliBff } from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  domains: DomainCliBff;
  contexts: ContextCliBff;
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
    search: new SearchCliBff(db),
    understandings: new UnderstandingCliBff(db),
  };

  return services;
}
