/**
 * domain 域 wire format（Effect Schema 单一真源）。
 * server types 与 electron ipc/contract 都从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";

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
