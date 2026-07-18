import {
  DomainCliBff,
  ContextCliBff,
  GraphCliBff,
  SearchCliBff,
  UnderstandingCliBff,
  RetrievalIndexCoordinator,
  type RetrievalIndexUpdateSink,
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
let retrievalIndexCoordinator: RetrievalIndexCoordinator | undefined;
let retrievalUpdatesQueued = false;

export async function getServices(): Promise<ReflectaCliServices> {
  const runtimeKey = getActiveRuntimeKey();
  if (services && servicesRuntimeKey === runtimeKey) return services;

  const db = getDb();
  retrievalIndexCoordinator?.stop();
  retrievalIndexCoordinator = new RetrievalIndexCoordinator({ getDb: () => db });
  retrievalUpdatesQueued = false;
  const retrievalIndexSink: RetrievalIndexUpdateSink = {
    enqueue(understandingIds) {
      const ids = [...understandingIds];
      if (ids.length === 0) return;
      retrievalUpdatesQueued = true;
      retrievalIndexCoordinator?.enqueue(ids);
    },
  };

  services = {
    domains: new DomainCliBff(db, retrievalIndexSink),
    contexts: new ContextCliBff(db, retrievalIndexSink),
    graph: new GraphCliBff(db),
    search: new SearchCliBff(db),
    understandings: new UnderstandingCliBff(db, retrievalIndexSink),
  };
  servicesRuntimeKey = runtimeKey;
  retrievalIndexCoordinator.start();
  await retrievalIndexCoordinator.flush().catch(() => undefined);

  return services;
}

export async function flushRetrievalIndexUpdates(): Promise<void> {
  if (!retrievalUpdatesQueued) return;
  retrievalUpdatesQueued = false;
  await retrievalIndexCoordinator?.flush();
}
