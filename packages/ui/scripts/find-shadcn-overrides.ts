/**
 * find-shadcn-overrides.ts（AST grep 驱动版）
 *
 * 扫描项目中对 shadcn 原语组件额外传 className 做样式定制的位置。
 * 底层用 ast-grep（tree-sitter AST）：生成规则文件后调用 `ast-grep scan`。
 *
 * 前置：全局安装 ast-grep（bun add -g @ast-grep/cli）
 *
 * 用法：
 *   bun run packages/ui/scripts/find-shadcn-overrides.ts
 *   bun run packages/ui/scripts/find-shadcn-overrides.ts --all   # 含 .test/.stories
 *
 * 说明：
 *   - shadcn 原语 = packages/ui/src/components/** 中导出的组件（Button/Badge/...）
 *   - 规则：kind jsx_opening_element + regex 匹配开标签文本 `^<Name\b...className=`
 *     （字段名、属性名子节点类型均按 tree-sitter-typescript grammar 核实）
 *   - 默认排除 components/ 自身、.test.、.stories.；--all 时包含后两者
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, ".."); // packages/ui
const REPO = resolve(ROOT, "../.."); // 仓库根
const COMPONENTS_DIR = join(ROOT, "src/components");

const INCLUDE_TESTS = process.argv.includes("--all");

/* ── 1. 收集 shadcn 原语组件导出名 ─────────────────────────────── */
const SHADCN_COMPONENTS = new Set<string>();
for (const file of readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith(".tsx"))) {
  const text = readFileSync(join(COMPONENTS_DIR, file), "utf8");
  for (const m of text.matchAll(/export (?:function|const) ([A-Z]\w*)/g)) {
    SHADCN_COMPONENTS.add(m[1]);
  }
  for (const m of text.matchAll(/export default (?:function )?([A-Z]\w*)/g)) {
    SHADCN_COMPONENTS.add(m[1]);
  }
  for (const m of text.matchAll(/export \{\s*([^}]*)\s*\}/g)) {
    for (const name of m[1].split(",")) {
      const clean = name.trim().replace(/\s+as\s+\w+/, "");
      if (/^[A-Z]\w*$/.test(clean)) SHADCN_COMPONENTS.add(clean);
    }
  }
}
const COMPONENT_ALT = Array.from(SHADCN_COMPONENTS)
  .sort((a, b) => b.length - a.length)
  .join("|");
console.error(`已识别 ${SHADCN_COMPONENTS.size} 个 shadcn 原语组件`);

/* ── 2. 生成 ast-grep 规则（tree-sitter grammar 核实）─────────────
 * jsx_opening_element: fields { attribute*, name }（attribute 单数！）
 * jsx_attribute 的 name 是子节点 property_identifier（无字段）
 * 用 regex 匹配开标签文本最稳（避开 has/all 组合在 0.45 的坑）        */
const RULE = `id: find-shadcn-classname
language: Tsx
severity: info
rule:
  kind: jsx_opening_element
  regex: "^<(${COMPONENT_ALT})\\\\b[\\\\s\\\\S]*\\\\bclassName="
`;

/* ── 3. 收集目标文件 ────────────────────────────────────────────── */
const TARGET_DIRS = [
  join(ROOT, "src"), // packages/ui/src（components/ 自身会被排除）
  join(REPO, "apps/electron/src/renderer/src"),
];

function collectTsx(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      collectTsx(full, out);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = TARGET_DIRS.flatMap((d) => collectTsx(d));
const isComponentSource = (f: string) => f.startsWith(COMPONENTS_DIR + "/");
const isSkippable = (f: string) =>
  (f.includes(".test.") || f.includes(".stories.")) && !INCLUDE_TESTS;
const targets = files.filter((f) => !isComponentSource(f) && !isSkippable(f));

/* ── 4. 跑 ast-grep scan ────────────────────────────────────────── */
const ruleFile = join(mkdtempSync(join(tmpdir(), "astgrep-")), "rule.yml");
writeFileSync(ruleFile, RULE);

try {
  const stdout = execFileSync("ast-grep", ["scan", "-r", ruleFile, ...targets], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  console.log(stdout);
} catch (error) {
  const err = error as { stdout?: string; stderr?: string; status?: number };
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) {
    // 过滤 ast-grep 的噪音告警
    const clean = err.stderr
      .split("\n")
      .filter((l) => !/WARNING|postinstall|Enable postinstall|^====$|^$/.test(l))
      .join("\n");
    if (clean.trim()) console.error(clean);
  }
  if ((err.status ?? 0) === 0) process.exit(0);
  // ast-grep scan 对"有匹配"可能返回非 0；这里不把匹配当失败
}
