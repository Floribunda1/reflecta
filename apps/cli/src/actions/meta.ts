export type ActionArgument = {
  name: string;
  description?: string;
  required: boolean;
};

export type ActionOption = {
  flags: string;
  description: string;
  required: boolean;
  defaultValue?: unknown;
};

export type ActionMeta = {
  name: string;
  description: string;
  mutates: boolean;
  hidden?: boolean;
  arguments?: ActionArgument[];
  options?: ActionOption[];
  returns?: string;
};

const actionMetaMap = new Map<string, ActionMeta>();
const resourceDescriptions = new Map<string, string>();

export function registerActionMeta(
  resource: string,
  action: string,
  meta: ActionMeta,
  resourceDescription?: string,
): void {
  actionMetaMap.set(`${resource}.${action}`, meta);
  if (resourceDescription && !resourceDescriptions.has(resource)) {
    resourceDescriptions.set(resource, resourceDescription);
  }
}

export function getActionMeta(resource: string, action: string): ActionMeta | undefined {
  return actionMetaMap.get(`${resource}.${action}`);
}

export function getAllActionMeta(): Map<string, ActionMeta> {
  return actionMetaMap;
}

export function getResourceDescriptions(): Map<string, string> {
  const visibleDescriptions = new Map<string, string>();
  for (const [resource, description] of resourceDescriptions) {
    if (getActionsByResource(resource).size > 0) {
      visibleDescriptions.set(resource, description);
    }
  }
  return visibleDescriptions;
}

export function getActionsByResource(resource: string): Map<string, ActionMeta> {
  const result = new Map<string, ActionMeta>();
  for (const [key, meta] of actionMetaMap) {
    const [r, a] = key.split(".");
    if (r === resource && !meta.hidden) {
      result.set(a, meta);
    }
  }
  return result;
}

export function getGroupedActions(): Array<{
  group: string;
  description: string;
  actions: Array<{ name: string; description: string; mutates: boolean }>;
}> {
  const resourceToActions = new Map<
    string,
    Array<{ name: string; description: string; mutates: boolean }>
  >();
  for (const [key, meta] of actionMetaMap) {
    if (meta.hidden) continue;
    const resource = key.split(".")[0];
    if (!resourceToActions.has(resource)) {
      resourceToActions.set(resource, []);
    }
    resourceToActions.get(resource)!.push({
      name: key.replace(".", " "),
      description: meta.description,
      mutates: meta.mutates,
    });
  }

  const result = [];
  for (const [resource, actions] of resourceToActions) {
    result.push({
      group: resource,
      description: resourceDescriptions.get(resource) ?? resource,
      actions,
    });
  }
  return result;
}
