import {
  DomainCliBff,
  ContextCliBff,
  GraphCliBff,
  SearchCliBff,
  UnderstandingCliBff,
} from "@reflecta/server";
import { getActiveRuntimeKey, getDb } from "./db";

export type ReflectaCliServices = {
  domains: DomainCliBff;
  contexts: ContextCliBff;
  graph: GraphCliBff;
  search: SearchCliBff;
  understandings: UnderstandingCliBff;
};

let services: ReflectaCliServices | undefined;
let servicesRuntimeKey: string | undefined;

export async function getServices(): Promise<ReflectaCliServices> {
  const runtimeKey = getActiveRuntimeKey();
  if (services && servicesRuntimeKey === runtimeKey) return services;

  const db = getDb();

  services = {
    domains: new DomainCliBff(db),
    contexts: new ContextCliBff(db),
    graph: new GraphCliBff(db),
    search: new SearchCliBff(db),
    understandings: new UnderstandingCliBff(db),
  };
  servicesRuntimeKey = runtimeKey;

  return services;
}
