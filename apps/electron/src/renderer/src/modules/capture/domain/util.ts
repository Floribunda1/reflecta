import type { DomainTreeNode } from "@shared/domain";

export const getDomainPath = (
  domainId: string,
  domains: DomainTreeNode[],
  separator = " › ",
): string => {
  const findPath = (id: string, cats: DomainTreeNode[], path: string[]): string[] | null => {
    for (const cat of cats) {
      if (cat.id === id) return [...path, cat.name];
      const found = findPath(id, cat.children, [...path, cat.name]);
      if (found) return found;
    }
    return null;
  };
  const result = findPath(domainId, domains, []);
  return result ? result.join(separator) : domainId;
};
