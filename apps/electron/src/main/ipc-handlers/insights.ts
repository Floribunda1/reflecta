/** insights 域 IPC handlers（业务在 services/insights-ops）。 */
import { InsightsError } from "../../ipc";
import { getRecapData as getRecapDataOp } from "../services/insights-ops";
import { liftPromise, type HandlerModule } from "./util";

const error = (message: string) => new InsightsError({ reason: message, code: 500 });

export const insights: HandlerModule = {
  domain: "insights",
  error,
  handlers: {
    "insights.getRecapData": () => liftPromise(error, () => getRecapDataOp()),
  },
};
