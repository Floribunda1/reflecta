import type { ReflectaDb } from "../../db/types";
import { CanvasCore } from "./core";

export class UnderstandingCanvasCliBff extends CanvasCore {
  constructor(db: ReflectaDb) {
    super(db);
  }
}
