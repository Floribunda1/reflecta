import { CategoryService, SearchService, ThoughtService } from "@reflecta/server";
import { getDB } from "./db.js";

const options = { getDb: getDB };

const thoughtService = new ThoughtService(options);
const categoryService = new CategoryService(options);
const searchService = new SearchService({ ...options, thoughtService });

export function searchThoughts(query: string, limit = 20, offset = 0) {
  return searchService.searchThoughts(query, { limit, offset });
}

export function getThoughtById(id: string) {
  return thoughtService.getThoughtById(id);
}

export function listCategories() {
  return categoryService.listCategories();
}

export function listRecentThoughts(limit = 20) {
  return thoughtService.listRecentThoughts(limit);
}

export function searchContexts(query: string, limit = 20, offset = 0) {
  return searchService.searchContexts(query, { limit, offset });
}
