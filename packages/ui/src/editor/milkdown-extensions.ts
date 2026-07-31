import { $nodeSchema, $prose, $remark } from "@milkdown/utils";
import { keymap } from "@milkdown/prose/keymap";
import { TextSelection, type Command } from "@milkdown/prose/state";
import { visit } from "unist-util-visit";

const wikiLinkPattern = /\[\[([ucd]):([A-Za-z0-9_-]+)\]\]/g;
const entityTypeByPrefix = {
  u: "understanding",
  c: "context",
  d: "domain",
} as const;
const prefixByEntityType = {
  understanding: "u",
  context: "c",
  domain: "d",
} as const;
const entityIcon = {
  understanding: "✦",
  context: "↳",
  domain: "#",
} as const;

function cleanWikiValue(value: unknown): string {
  return String(value ?? "")
    .replaceAll(/[\n\r\]]/g, " ")
    .trim();
}

type AstNode = {
  type: string;
  data?: Record<string, unknown>;
};
type AstParent = AstNode & { children: AstNode[] };
type TextNode = AstNode & { type: "text"; value?: unknown };
type WikiLinkNode = AstNode & {
  type: "wikiLink";
  entityType: keyof typeof prefixByEntityType;
  id: string;
};

const remarkWikiLink = $remark("reflectaWikiLink", () => () => (tree) => {
  visit(tree, "text", (node, index, parent) => {
    const textNode = node as TextNode;
    const parentNode = parent as AstParent | undefined;
    if (!parentNode || typeof index !== "number") return;

    const value = String(textNode.value ?? "");
    const replacements: Array<TextNode | WikiLinkNode> = [];
    let cursor = 0;

    for (const match of value.matchAll(wikiLinkPattern)) {
      const start = match.index ?? -1;
      if (start < 0) continue;
      if (start > cursor) {
        replacements.push({ type: "text", value: value.slice(cursor, start) });
      }

      replacements.push({
        type: "wikiLink",
        entityType: entityTypeByPrefix[match[1] as keyof typeof entityTypeByPrefix],
        id: cleanWikiValue(match[2]),
      });
      cursor = start + match[0].length;
    }

    if (replacements.length === 0) return;
    if (cursor < value.length) {
      replacements.push({ type: "text", value: value.slice(cursor) });
    }

    parentNode.children.splice(index, 1, ...replacements);
  });
});

const wikiLinkSchema = $nodeSchema("wiki_link", () => ({
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  attrs: {
    title: { default: "", validate: "string" },
    entityType: { default: "understanding", validate: "string" },
    id: { default: "", validate: "string" },
  },
  parseDOM: [
    {
      tag: "a[data-wiki-link]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          title: dom.textContent?.trim() ?? "",
          entityType: dom.dataset.entityType ?? "understanding",
          id: dom.dataset.wikiLink ?? "",
        };
      },
    },
  ],
  toDOM: (node) => {
    const entityType = cleanWikiValue(node.attrs.entityType) as keyof typeof prefixByEntityType;
    const id = cleanWikiValue(node.attrs.id);
    const title = cleanWikiValue(node.attrs.title);
    return [
      "a",
      {
        href: "#",
        class: `wiki-link reflecta-wiki-link wiki-link--${entityType}`,
        "data-wiki-link": id,
        "data-entity-type": entityType,
      },
      `${entityIcon[entityType] ?? "○"} ${title || id}`,
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === "wikiLink",
    runner: (state, node, type) => {
      state.addNode(type, {
        entityType: cleanWikiValue(node.entityType),
        id: cleanWikiValue(node.id),
      });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "wiki_link",
    runner: (state, node) => {
      const entityType = cleanWikiValue(node.attrs.entityType) as keyof typeof prefixByEntityType;
      const id = cleanWikiValue(node.attrs.id);
      state.addNode(
        "text",
        undefined,
        entityType && id ? `[[${prefixByEntityType[entityType]}:${id}]]` : "",
      );
    },
  },
}));

const deleteEmptyNestedTextblock: Command = (state, dispatch) => {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty || !selection.$cursor) {
    return false;
  }

  const $cursor = selection.$cursor;
  const parent = $cursor.parent;
  if ($cursor.parentOffset !== 0 || !parent.isTextblock || parent.content.size > 0) {
    return false;
  }
  if ($cursor.depth < 2) return false;

  const containerDepth = $cursor.depth - 1;
  const container = $cursor.node(containerDepth);
  if (container.childCount <= 1) return false;

  const index = $cursor.index(containerDepth);
  if (!container.canReplace(index, index + 1)) return false;

  dispatch?.(
    state.tr.delete($cursor.before($cursor.depth), $cursor.after($cursor.depth)).scrollIntoView(),
  );
  return true;
};

const emptyNestedBlockKeymap = $prose(() =>
  keymap({
    Backspace: deleteEmptyNestedTextblock,
  }),
);

export const reflectaMilkdownExtensions = [
  remarkWikiLink,
  wikiLinkSchema,
  emptyNestedBlockKeymap,
].flat();
