/** domain 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import { Domain, CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "@reflecta/shared";

export class DomainListError extends S.TaggedError<DomainListError>()("DomainListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const DomainList = rpc("domain.listDomains", S.Struct({}), S.Array(Domain), DomainListError);
export const DomainGetById = rpc(
  "domain.getDomainById",
  S.Struct({ id: S.String }),
  S.NullOr(Domain),
  DomainListError,
);
export const DomainReorder = rpc(
  "domain.reorderDomains",
  S.Struct({ items: S.Array(ReorderDomainItem) }),
  S.Void,
  DomainListError,
);
export const DomainCreate = rpc(
  "domain.createDomain",
  S.Struct({ input: CreateDomainInput }),
  Domain,
  DomainListError,
);
export const DomainUpdate = rpc(
  "domain.updateDomain",
  S.Struct({ id: S.String, input: UpdateDomainInput }),
  Domain,
  DomainListError,
);
export const DomainDelete = rpc(
  "domain.deleteDomain",
  S.Struct({ id: S.String, deleteUnderstandings: S.Boolean }),
  S.Void,
  DomainListError,
);

// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export { Domain, CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "@reflecta/shared";
