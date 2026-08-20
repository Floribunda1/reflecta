import { Effect } from "effect";
import type { Domain } from "./types";
import { DomainCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class DomainElectronBff extends DomainCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb(), options.retrievalIndex);
  }

  listDomains(): Effect.Effect<Domain[]> {
    return this.listDomainRows();
  }

  getDomainById(id: string): Effect.Effect<Domain | null> {
    return this.getDomainRow(id);
  }
}
