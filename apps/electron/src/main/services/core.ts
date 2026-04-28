import { getDBInstance } from "@main/db";
import {
  CategoryService,
  ContextService,
  SearchService,
  ThoughtService,
  TrashService,
} from "@reflecta/server";

const options = { getDb: getDBInstance };

export const thoughtService = new ThoughtService(options);
export const categoryService = new CategoryService(options);
export const contextService = new ContextService(options);
export const searchService = new SearchService({ ...options, thoughtService });
export const trashService = new TrashService(options);
