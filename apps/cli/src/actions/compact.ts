import type {
  Category,
  ContextDTO,
  FtsContextResult,
  SearchResult,
  ThoughtDTO,
  ThoughtSummaryDTO,
  TrashedContextDTO,
  TrashedThoughtDTO,
} from "@reflecta/server";

export function compactCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
  };
}

export function compactContext(context: ContextDTO) {
  return {
    id: context.id,
    thoughtId: context.thoughtId,
    sourceType: context.sourceType,
    sourceName: context.sourceName,
    content: context.content,
  };
}

export function compactThoughtSummary(thought: ThoughtSummaryDTO) {
  return {
    id: thought.id,
    type: thought.type,
    title: thought.title,
    body: thought.body,
    categoryIds: thought.categoryIds,
  };
}

export function compactThought(thought: ThoughtDTO) {
  return {
    id: thought.id,
    type: thought.type,
    title: thought.title,
    body: thought.body,
    categoryIds: thought.categoryIds,
    contexts: thought.contexts.map(compactContext),
    connections: thought.connections.map(compactThoughtSummary),
    referencedBy: thought.referencedBy.map(compactThoughtSummary),
  };
}

export function compactFtsContext(result: FtsContextResult) {
  return {
    contextId: result.contextId,
    thoughtId: result.thoughtId,
    sourceName: result.sourceName,
    snippet: result.snippet,
  };
}

export function compactSearchResult(result: SearchResult) {
  return {
    thoughts: result.thoughts.map(compactThoughtSummary),
    contexts: result.contexts.map(compactFtsContext),
  };
}

export function compactTrashedThought(thought: TrashedThoughtDTO) {
  return {
    id: thought.id,
    type: thought.type,
    title: thought.title,
    body: thought.body,
  };
}

export function compactTrashedContext(context: TrashedContextDTO) {
  return {
    id: context.id,
    thoughtId: context.thoughtId,
    thoughtTitle: context.thoughtTitle,
    sourceType: context.sourceType,
    sourceName: context.sourceName,
    content: context.content,
  };
}
