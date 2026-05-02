import { getDBInstance } from "@main/db";
import {
  CategoryElectronBff,
  ContextElectronBff,
  SearchElectronBff,
  ThoughtElectronBff,
  TrashElectronBff,
} from "@reflecta/server";

const options = { getDb: getDBInstance };

export const thoughtService = new ThoughtElectronBff(options);
export const categoryService = new CategoryElectronBff(options);
export const contextService = new ContextElectronBff(options);
export const searchService = new SearchElectronBff({ ...options, thoughtService });
export const trashService = new TrashElectronBff(options);
