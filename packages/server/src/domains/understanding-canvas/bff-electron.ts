import type { ReflectaDb } from "../../db/types";
import { CanvasCore } from "./core";

/** Electron renderer 侧 BFF：复用 CanvasCore（含 getCanvasDetail 装配） */
export class UnderstandingCanvasElectronBff extends CanvasCore {
  constructor(db: ReflectaDb) {
    super(db);
  }
}
