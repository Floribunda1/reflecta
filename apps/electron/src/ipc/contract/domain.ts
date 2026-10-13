/** domain 域契约。DTO schema 单一真源在 @reflecta/shared，这里只留 rpc 面。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import { Domain, CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "@reflecta/shared";

export class DomainListError extends S.TaggedError<DomainListError>()("DomainListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const DomainList = Rpc.make("domain.listDomains", {
  payload: S.Struct({}),
  success: S.Array(Domain),
  error: DomainListError,
});
export const DomainGetById = Rpc.make("domain.getDomainById", {
  payload: S.Struct({ id: S.String }),
  success: S.NullOr(Domain),
  error: DomainListError,
});
export const DomainReorder = Rpc.make("domain.reorderDomains", {
  payload: S.Struct({ items: S.Array(ReorderDomainItem) }),
  success: S.Void,
  error: DomainListError,
});
export const DomainCreate = Rpc.make("domain.createDomain", {
  payload: S.Struct({ input: CreateDomainInput }),
  success: Domain,
  error: DomainListError,
});
export const DomainUpdate = Rpc.make("domain.updateDomain", {
  payload: S.Struct({ id: S.String, input: UpdateDomainInput }),
  success: Domain,
  error: DomainListError,
});
export const DomainDelete = Rpc.make("domain.deleteDomain", {
  payload: S.Struct({ id: S.String, deleteUnderstandings: S.Boolean }),
  success: S.Void,
  error: DomainListError,
});

// ipc 内部（index 装配）仍需这些类型/schema，从 shared 再导出（定义单一真源）。
export { Domain, CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "@reflecta/shared";
