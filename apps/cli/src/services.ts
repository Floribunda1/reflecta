import {
  CategoryService,
  ContextService,
  SearchService,
  ThoughtService,
  TrashService,
} from "@reflecta/server";
import { getDb, initializeDb } from "./db";

export type ReflectaCliServices = {
  categories: CategoryService;
  contexts: ContextService;
  search: SearchService;
  thoughts: ThoughtService;
  trash: TrashService;
};

let services: ReflectaCliServices | undefined;

export async function getServices(): Promise<ReflectaCliServices> {
  if (services) return services;

  await initializeDb();

  const context = { getDb };
  const thoughts = new ThoughtService(context);

  services = {
    categories: new CategoryService(context),
    contexts: new ContextService(context),
    search: new SearchService({ ...context, thoughtService: thoughts }),
    thoughts,
    trash: new TrashService(context),
  };

  return services;
}
