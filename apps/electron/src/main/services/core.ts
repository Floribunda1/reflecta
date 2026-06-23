import { getDBInstance } from "@main/db";
import {
  DomainCliBff,
  DomainElectronBff,
  ContextCliBff,
  ContextElectronBff,
  SearchCliBff,
  SearchElectronBff,
  UnderstandingCliBff,
  UnderstandingElectronBff,
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

export const understandingService = createLazy(() => new UnderstandingElectronBff(options));
export const understandingCliService = createLazy(() => new UnderstandingCliBff(getDBInstance()));
export const domainService = createLazy(() => new DomainElectronBff(options));
export const domainCliService = createLazy(() => new DomainCliBff(getDBInstance()));
export const contextService = createLazy(() => new ContextElectronBff(options));
export const contextCliService = createLazy(() => new ContextCliBff(getDBInstance()));
export const searchService = createLazy(
  () => new SearchElectronBff({ ...options, understandingService }),
);
export const searchCliService = createLazy(() => new SearchCliBff(getDBInstance()));
export const trashService = createLazy(() => new TrashElectronBff(options));

export const piAgentHost = createLazy(() => new PiAgentHost());
