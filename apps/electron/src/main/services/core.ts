import { getDBInstance } from "@main/db";
import {
  CategoryElectronBff,
  ContextElectronBff,
  SearchElectronBff,
  ThoughtElectronBff,
  TrashElectronBff,
} from "@reflecta/server";

const options = { getDb: getDBInstance };

function createLazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!instance) instance = factory();
      const value = instance[prop as keyof T];
      return typeof value === "function" ? (value as Function).bind(instance) : value;
    },
  });
}

export const thoughtService = createLazy(() => new ThoughtElectronBff(options));
export const categoryService = createLazy(() => new CategoryElectronBff(options));
export const contextService = createLazy(() => new ContextElectronBff(options));
export const searchService = createLazy(
  () => new SearchElectronBff({ ...options, thoughtService }),
);
export const trashService = createLazy(() => new TrashElectronBff(options));
