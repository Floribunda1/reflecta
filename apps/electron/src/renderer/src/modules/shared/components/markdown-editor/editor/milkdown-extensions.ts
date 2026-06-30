import { $nodeSchema, $prose, $remark } from "@milkdown/utils";
import { keymap } from "@milkdown/prose/keymap";
import { TextSelection, type Command } from "@milkdown/prose/state";
import { visit } from "unist-util-visit";

const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

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
type WikiLinkNode = AstNode & { type: "wikiLink"; title: string; id: string };

export const remarkWikiLink = $remark("reflectaWikiLink", () => () => (tree) => {
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
        title: cleanWikiValue(match[1]),
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

export const wikiLinkSchema = $nodeSchema("wiki_link", () => ({
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  attrs: {
    title: { default: "", validate: "string" },
    id: { default: "", validate: "string" },
  },
  parseDOM: [
    {
      tag: "a[data-wiki-link]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          title: dom.textContent?.trim() ?? "",
          id: dom.dataset.wikiLink ?? "",
        };
      },
    },
  ],
  toDOM: (node) => [
    "a",
    {
      href: "#",
      class: "wiki-link reflecta-wiki-link",
      "data-wiki-link": cleanWikiValue(node.attrs.id),
    },
    cleanWikiValue(node.attrs.title),
  ],
  parseMarkdown: {
    match: (node) => node.type === "wikiLink",
    runner: (state, node, type) => {
      state.addNode(type, {
        title: cleanWikiValue(node.title),
        id: cleanWikiValue(node.id),
      });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "wiki_link",
    runner: (state, node) => {
      const title = cleanWikiValue(node.attrs.title);
      const id = cleanWikiValue(node.attrs.id);
      state.addNode("text", undefined, title && id ? `[[${title}#${id}]]` : "");
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

export const emptyNestedBlockKeymap = $prose(() =>
  keymap({
    Backspace: deleteEmptyNestedTextblock,
  }),
);

export const reflectaMilkdownExtensions = [
  remarkWikiLink,
  wikiLinkSchema,
  emptyNestedBlockKeymap,
].flat();
