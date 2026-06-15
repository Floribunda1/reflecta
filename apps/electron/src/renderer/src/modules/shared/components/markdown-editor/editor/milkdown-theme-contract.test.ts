import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import { describe, expect, test } from "vitest";

const themeEntry = fileURLToPath(new URL("./milkdown-theme.scss", import.meta.url));
const themeImports = readFileSync(
  new URL("./milkdown-theme/_imports.scss", import.meta.url),
  "utf8",
);
const compiledCss = sass.compile(themeEntry).css;
const demoMarkdown = readFileSync(new URL("../../demo.md", import.meta.url), "utf8");

type CssRule = {
  selector: string;
  body: string;
};

function rules(): CssRule[] {
  const matches = compiledCss.matchAll(/([^{}]+)\{([^{}]+)\}/g);

  return Array.from(matches, ([, selector, body]) => ({
    selector: selector.replace(/\s+/g, " ").trim(),
    body: body.replace(/\s+/g, " ").trim(),
  }));
}

function findRule(selectorPart: string): CssRule {
  const rule =
    rules().find((candidate) => candidate.selector === selectorPart) ??
    rules().find((candidate) => candidate.selector.includes(selectorPart));
  expect(rule, `Missing CSS selector containing: ${selectorPart}`).toBeDefined();
  return rule as CssRule;
}

function expectDeclaration(selectorPart: string, property: string, valuePattern: RegExp): void {
  const declarationPattern = new RegExp(`${property}\\s*:\\s*${valuePattern.source}`);
  const matchingRules = rules().filter((candidate) => candidate.selector.includes(selectorPart));

  expect(matchingRules.length, `Missing CSS selector containing: ${selectorPart}`).toBeGreaterThan(
    0,
  );
  expect(
    matchingRules.some((rule) => declarationPattern.test(rule.body)),
    `Expected ${selectorPart} to define ${property} matching ${valuePattern}`,
  ).toBe(true);
}

describe("milkdown theme contract", () => {
  test("uses Crepe common structure without importing a full visual theme", () => {
    expect(themeImports).toContain('@import "@milkdown/crepe/theme/common/style.css";');
    expect(themeImports).not.toContain("@milkdown/crepe/theme/nord.css");
    expect(themeImports).not.toContain("@milkdown/crepe/theme/crepe.css");
    expect(themeImports).not.toContain("@milkdown/crepe/theme/frame.css");
    expect(compiledCss).not.toContain("@milkdown/crepe/theme/nord.css");
    expect(compiledCss).not.toContain("@milkdown/crepe/theme/crepe.css");
    expect(compiledCss).not.toContain("@milkdown/crepe/theme/frame.css");
  });

  test("bridges Crepe tokens to Reflecta design tokens", () => {
    const rule = findRule(".reflecta-md-editor .milkdown");

    expect(rule.body).toContain("--crepe-color-background: var(--background)");
    expect(rule.body).toContain("--crepe-color-on-background: var(--foreground)");
    expect(rule.body).toContain("--crepe-color-outline: var(--border)");
    expect(rule.body).toContain("--crepe-color-primary: var(--primary)");
    expect(rule.body).toContain("--crepe-font-default: inherit");
    expect(rule.body).toContain("--crepe-radius-control: min(var(--radius-md), 8px)");
    expect(rule.body).toContain("--crepe-shadow-1:");
  });

  test("overrides Crepe base typography leaks", () => {
    expectDeclaration(".reflecta-md-editor .ProseMirror", "font-size", /14px/);
    expectDeclaration(".reflecta-md-editor .milkdown .ProseMirror p", "font-size", /14px/);
    expectDeclaration(".reflecta-md-editor .milkdown .ProseMirror p", "line-height", /22px/);

    for (const heading of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      findRule(`.reflecta-md-editor .milkdown .ProseMirror ${heading}`);
    }
  });

  test("covers blockquote, divider, and fallback text blocks", () => {
    expectDeclaration(
      ".reflecta-md-editor .milkdown .ProseMirror blockquote::before",
      "content",
      /none/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .ProseMirror blockquote",
      "border-left",
      /var\(--border\)|var\(--primary\)|color-mix/,
    );
    expectDeclaration(".reflecta-md-editor .milkdown .ProseMirror hr", "height", /1px/);
    expectDeclaration(".reflecta-md-editor .milkdown .ProseMirror hr", "padding", /0/);
  });

  test("targets Crepe list DOM instead of only native list elements", () => {
    for (const selectorPart of [
      ".reflecta-md-editor .milkdown .milkdown-list-item-block",
      ".reflecta-md-editor .milkdown .milkdown-list-item-block > .list-item",
      ".reflecta-md-editor .milkdown .milkdown-list-item-block li .label-wrapper",
      ".reflecta-md-editor .milkdown .milkdown-list-item-block li .label-wrapper .label",
      ".reflecta-md-editor .milkdown .milkdown-list-item-block p",
      ".reflecta-md-editor .milkdown .ProseMirror input[type=checkbox]",
    ]) {
      findRule(selectorPart);
    }

    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-list-item-block p",
      "font-size",
      /14px/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-list-item-block p",
      "line-height",
      /22px/,
    );
  });

  test("uses app token chrome for media, code blocks, and tables", () => {
    expectDeclaration(".reflecta-md-editor .milkdown-code-block", "border", /[^;]*var\(--border\)/);
    expectDeclaration(
      ".reflecta-md-editor .milkdown-code-block",
      "border-radius",
      /var\(--radius-md\)|min\(var\(--radius-md\), 8px\)/,
    );
    expectDeclaration(".reflecta-md-editor .milkdown-code-block .cm-content", "font-size", /13px/);
    expectDeclaration(
      ".reflecta-md-editor .milkdown-code-block .cm-activeLineGutter",
      "background",
      /color-mix|transparent|var\(--/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown-table-block th",
      "background",
      /var\(--muted\)|color-mix/,
    );
    expectDeclaration(".reflecta-md-editor .milkdown-table-block td", "padding", /0\.[0-9]+rem/);
    expectDeclaration(
      ".reflecta-md-editor .milkdown-image-block img",
      "border-radius",
      /var\(--radius-md\)|min\(var\(--radius-md\), 8px\)/,
    );
  });

  test("uses app popover tokens for floating controls", () => {
    for (const selectorPart of [
      ".reflecta-md-editor .milkdown .milkdown-toolbar",
      ".reflecta-md-editor .milkdown .milkdown-toolbar .toolbar-item",
      ".reflecta-md-editor .milkdown .milkdown-link-preview > .link-preview",
      ".reflecta-md-editor .milkdown .milkdown-link-edit > .link-edit",
    ]) {
      findRule(selectorPart);
    }

    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-toolbar",
      "background",
      /var\(--popover\)/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-toolbar",
      "box-shadow",
      /var\(--crepe-shadow-1\)/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-toolbar .toolbar-item",
      "width",
      /28px/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-toolbar .toolbar-item svg",
      "width",
      /16px/,
    );
  });

  test("removes Crepe block add and drag handle chrome", () => {
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-block-handle",
      "display",
      /none !important/,
    );
    expect(compiledCss).not.toContain(".milkdown-block-handle .operation-item");
  });

  test("styles slash menu as a compact command-palette surface", () => {
    for (const selectorPart of [
      ".reflecta-md-editor .milkdown .milkdown-slash-menu",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=false]",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=true]",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .tab-group",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups .menu-group li",
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups .menu-group li.hover",
    ]) {
      findRule(selectorPart);
    }

    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=false]",
      "display",
      /none/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=true]",
      "display",
      /flex/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=true]",
      "height",
      /fit-content/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu[data-show=true]",
      "background",
      /var\(--popover\)/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups .menu-group",
      "display",
      /none/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups",
      "max-height",
      /16rem/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups",
      "overflow",
      /hidden auto|auto/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups .menu-group li svg",
      "width",
      /16px/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .milkdown-slash-menu .menu-groups .menu-group li.hover",
      "background",
      /var\(--muted\)/,
    );
  });

  test("hides wiki link suggestions when the provider is closed", () => {
    for (const selectorPart of [
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion",
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion[data-show=false]",
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion[data-show=true]",
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion-item",
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion-status",
    ]) {
      findRule(selectorPart);
    }

    expectDeclaration(
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion[data-show=false]",
      "display",
      /none/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion",
      "position",
      /fixed/,
    );
    expectDeclaration(
      ".reflecta-md-editor .milkdown .reflecta-md-editor__wiki-suggestion[data-show=true]",
      "background",
      /var\(--popover\)/,
    );
  });

  test("keeps readonly preview as editor rendering without editing controls", () => {
    for (const selectorPart of [
      ".markdown-preview .reflecta-md-editor .milkdown-block-handle",
      ".markdown-preview .reflecta-md-editor .milkdown-toolbar",
      ".markdown-preview .reflecta-md-editor .milkdown-slash-menu",
      ".markdown-preview .reflecta-md-editor .milkdown-link-preview",
      ".markdown-preview .reflecta-md-editor .milkdown-link-edit",
    ]) {
      findRule(selectorPart);
    }
  });

  test("keeps demo markdown as the canonical block coverage fixture", () => {
    for (const section of [
      "H1 一级标题",
      "H2 二级标题",
      "H3 三级标题",
      "H4 四级标题",
      "H5 五级标题",
      "H6 六级标题",
      "文字样式",
      "无序列表",
      "有序列表",
      "任务列表（Task List）",
      "链接与图片",
      "代码块",
      "表格",
      "分隔线",
      "转义字符",
      "数学公式（LaTeX，部分编辑器支持）",
      "脚注（部分编辑器支持）",
      "定义列表（部分编辑器支持）",
      "综合嵌套示例",
    ]) {
      expect(demoMarkdown).toContain(section);
    }
  });
});
