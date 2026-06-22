import { getDBInstance } from "@main/db";
import {
  CategoryCliBff,
  CategoryElectronBff,
  ContextCliBff,
  ContextElectronBff,
  GraphCliBff,
  SearchCliBff,
  SearchElectronBff,
  SnapshotCliBff,
  ThoughtCliBff,
  ThoughtElectronBff,
  TrashElectronBff,
} from "@reflecta/server";
import { PiAgentHost } from "./agent/pi-agent-host";

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
export const thoughtCliService = createLazy(() => new ThoughtCliBff(getDBInstance()));
export const categoryService = createLazy(() => new CategoryElectronBff(options));
export const categoryCliService = createLazy(() => new CategoryCliBff(getDBInstance()));
export const contextService = createLazy(() => new ContextElectronBff(options));
export const contextCliService = createLazy(() => new ContextCliBff(getDBInstance()));
export const searchService = createLazy(
  () => new SearchElectronBff({ ...options, thoughtService }),
);
export const searchCliService = createLazy(() => new SearchCliBff(getDBInstance()));
export const graphService = createLazy(() => new GraphCliBff(getDBInstance()));
export const snapshotService = createLazy(() => new SnapshotCliBff(getDBInstance()));
export const trashService = createLazy(() => new TrashElectronBff(options));

export const piAgentHost = createLazy(() => new PiAgentHost());
