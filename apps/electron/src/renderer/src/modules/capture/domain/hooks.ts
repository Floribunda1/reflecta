import type { ReorderDomainItem } from "@shared/domain";
import { useCallback } from "react";
import { useDomainMutations } from "../queries";

export function useDomainActions() {
  const domainMutations = useDomainMutations();

  const renameDomain = useCallback(
    async (id: string, name: string) => {
      await domainMutations.updateDomain.mutateAsync({ id, input: { name } });
    },
    [domainMutations.updateDomain],
  );

  const updateDomain = useCallback(
    async (id: string, input: { name?: string; parentId?: string | null }) => {
      await domainMutations.updateDomain.mutateAsync({ id, input });
    },
    [domainMutations.updateDomain],
  );

  const createDomain = useCallback(
    async (input: { name: string; parentId?: string | null }) => {
      await domainMutations.createDomain.mutateAsync({
        name: input.name,
        parentId: input.parentId ?? null,
      });
    },
    [domainMutations.createDomain],
  );

  const deleteDomain = useCallback(
    async (id: string, deleteUnderstandings?: boolean) => {
      await domainMutations.deleteDomain.mutateAsync({ id, deleteUnderstandings });
    },
    [domainMutations.deleteDomain],
  );

  const reorderDomains = useCallback(
    async (items: ReorderDomainItem[]) => {
      await domainMutations.reorderDomains.mutateAsync(items);
    },
    [domainMutations.reorderDomains],
  );

  return {
    renameDomain,
    updateDomain,
    createDomain,
    deleteDomain,
    reorderDomains,
  };
}
