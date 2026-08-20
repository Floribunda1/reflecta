import { Effect } from "effect";
import type { ContextDTO, CreateContextInput, UpdateContextInput } from "./types";
import { ContextCore, type ContextError } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class ContextElectronBff extends ContextCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb(), options.retrievalIndex);
  }

  createContext(input: CreateContextInput): Effect.Effect<ContextDTO, ContextError> {
    return super._createContext(input);
  }

  getContextById(id: string): Effect.Effect<ContextDTO | null> {
    return this.getContextRow(id).pipe(Effect.map((row) => row as ContextDTO | null));
  }

  updateContext(id: string, input: UpdateContextInput): Effect.Effect<ContextDTO, ContextError> {
    return super._updateContext(id, input);
  }
}
