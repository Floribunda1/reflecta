/** domain 域 IPC handlers（业务在 services/core 的 domainService）。 */
import { DomainListError } from "../../ipc";
import { domainService } from "../services/core";
import { toVoid, type HandlerModule } from "./util";

const error = (message: string) => new DomainListError({ reason: message, code: 500 });

export const domain: HandlerModule = {
  domain: "domain",
  error,
  handlers: {
    "domain.listDomains": () => domainService.listDomains(),
    "domain.getDomainById": ({ id }) => domainService.getDomainById(id),
    "domain.reorderDomains": ({ items }) => domainService.reorderDomains([...items]).pipe(toVoid),
    "domain.createDomain": ({ input }) => domainService.createDomain(input),
    "domain.updateDomain": ({ id, input }) => domainService.updateDomain(id, input),
    "domain.deleteDomain": ({ id, deleteUnderstandings }) =>
      domainService.deleteDomain(id, deleteUnderstandings).pipe(toVoid),
  },
};
