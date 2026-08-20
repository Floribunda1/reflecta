/** domain 域契约（迁移批 ②）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class DomainListError extends S.TaggedError<DomainListError>()("DomainListError", {
  reason: S.String,
  code: S.Number,
}) {}

export const Domain = S.Struct({
  id: S.String,
  name: S.String,
  parentId: S.NullOr(S.String),
  sortOrder: S.Number,
  createdAt: S.String,
  updatedAt: S.String,
});
export type Domain = S.Schema.Type<typeof Domain>;

export const CreateDomainInput = S.Struct({
  name: S.String,
  parentId: S.optional(S.NullOr(S.String)),
});
export type CreateDomainInput = S.Schema.Type<typeof CreateDomainInput>;

export const UpdateDomainInput = S.Struct({
  name: S.optional(S.String),
  parentId: S.optional(S.NullOr(S.String)),
});
export type UpdateDomainInput = S.Schema.Type<typeof UpdateDomainInput>;

export const ReorderDomainItem = S.Struct({
  id: S.String,
  parentId: S.NullOr(S.String),
  sortOrder: S.Number,
});
export type ReorderDomainItem = S.Schema.Type<typeof ReorderDomainItem>;

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
