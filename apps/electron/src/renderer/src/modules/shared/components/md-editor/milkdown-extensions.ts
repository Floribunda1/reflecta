import { Plugin } from "@milkdown/prose/state";
import { $nodeSchema, $remark } from "@milkdown/utils";
import { $prose } from "@milkdown/utils";
import mermaid from "mermaid";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { normalizeAdmonitionType } from "./markdown-support";

const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

function cleanWikiValue(value: unknown): string {
  return String(value ?? "")
    .replaceAll(/[\n\r\]]/g, " ")
    .trim();
}

export const remarkWikiLink = $remark("reflectaWikiLink", () => () => (tree: any) => {
  visit(tree, "text", (node: any, index: number | undefined, parent: any) => {
    if (!parent || typeof index !== "number") return;

    const value = String(node.value ?? "");
    const replacements: any[] = [];
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

    parent.children.splice(index, 1, ...replacements);
  });
});

export const remarkDirectivePlugin = $remark("reflectaDirective", () => remarkDirective);

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

export const admonitionSchema = $nodeSchema("admonition", () => ({
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  attrs: {
    type: { default: "note", validate: "string" },
  },
  parseDOM: [
    {
      tag: "aside[data-admonition]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return { type: normalizeAdmonitionType(dom.dataset.type) };
      },
    },
  ],
  toDOM: (node) => [
    "aside",
    {
      "data-admonition": "",
      "data-type": normalizeAdmonitionType(node.attrs.type),
      class: "reflecta-admonition",
    },
    ["div", { class: "reflecta-admonition__content" }, 0],
  ],
  parseMarkdown: {
    match: (node) => node.type === "containerDirective",
    runner: (state, node, type) => {
      state.openNode(type, { type: normalizeAdmonitionType(node.name) });
      state.next(node.children ?? []);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "admonition",
    runner: (state, node) => {
      state.openNode("containerDirective", undefined, {
        name: normalizeAdmonitionType(node.attrs.type),
      });
      state.next(node.content);
      state.closeNode();
    },
  },
}));

export const mermaidPreviewPlugin = $prose(() => {
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

  return new Plugin({
    view: (view) => {
      let renderVersion = 0;
      let destroyed = false;

      const render = () => {
        if (destroyed) return;
        const version = ++renderVersion;
        const previewRoot = view.dom.parentElement ?? view.dom;
        previewRoot
          .querySelectorAll(".reflecta-md-editor__mermaid-preview")
          .forEach((element) => element.remove());

        const codeBlocks: Array<{ source: string; language: string }> = [];
        view.state.doc.descendants((node) => {
          if (node.type.name === "code_block") {
            codeBlocks.push({
              source: node.textContent,
              language: String(node.attrs.language ?? ""),
            });
          }
          return true;
        });

        codeBlocks.forEach((codeBlock, index) => {
          if (codeBlock.language !== "mermaid") return;

          const element = document.createElement("div");
          element.className = "reflecta-mermaid reflecta-md-editor__mermaid-preview";
          element.textContent = codeBlock.source;
          previewRoot.append(element);

          const renderId = `reflecta-editor-mermaid-${index}-${Math.random()
            .toString(36)
            .slice(2)}`;
          void mermaid
            .render(renderId, codeBlock.source)
            .then((result) => {
              if (!destroyed && version === renderVersion) element.innerHTML = result.svg;
            })
            .catch(() => {
              if (destroyed) return;
              element.dataset.mermaidError = "true";
              element.textContent = codeBlock.source;
            });
        });
      };

      queueMicrotask(render);

      return {
        update: render,
        destroy: () => {
          destroyed = true;
          renderVersion += 1;
          const previewRoot = view.dom.parentElement ?? view.dom;
          previewRoot
            .querySelectorAll(".reflecta-md-editor__mermaid-preview")
            .forEach((element) => element.remove());
        },
      };
    },
  });
});

export const reflectaMilkdownExtensions = [
  remarkDirectivePlugin,
  remarkWikiLink,
  wikiLinkSchema,
  admonitionSchema,
  mermaidPreviewPlugin,
].flat();
