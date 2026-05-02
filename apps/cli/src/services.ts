import {
  CategoryCliBff,
  ContextCliBff,
  SearchCliBff,
  ThoughtCliBff,
  TrashElectronBff,
} from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  categories: CategoryCliBff;
  contexts: ContextCliBff;
  search: SearchCliBff;
  thoughts: ThoughtCliBff;
  trash: TrashElectronBff;
};

let services: ReflectaCliServices | undefined;

export async function getServices(): Promise<ReflectaCliServices> {
  if (services) return services;

  await initializeDb();

  const db = getDb();

  services = {
    categories: new CategoryCliBff(db),
    contexts: new ContextCliBff(db),
    search: new SearchCliBff(db),
    thoughts: new ThoughtCliBff(db),
    trash: new TrashElectronBff({ getDb }),
  };

  return services;
}
