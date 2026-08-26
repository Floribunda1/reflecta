/**
 * Agent 工具面真源（名字 + 分类 + 中文标签的单一权威）。
 *
 * 会话实际工具面 = createAgentSession 的 tools allowlist：
 * builtin（pi 内置读改执行）+ readonly（知识只读）+ approval（写需审批）+
 * web_access（pi-web-access 扩展）+ image（生图）+ present（只读展示）。
 *
 * main（pi-* 服务注册与 allowlist 拼接）与 packages/ui（渲染文案 / Storybook
 * fixture 完整性）均从这里消费，避免多文件各自维护导致漂移。
 */
export const PI_BUILTIN_TOOL_NAMES = ["read", "bash", "edit", "write"] as const;

export const PI_READ_ONLY_TOOL_NAMES = [
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
  "attachment_read",
  "retrieve_knowledge",
  "canvas_read",
  "canvas_list",
  "canvas_search",
] as const;

export const PI_APPROVAL_TOOL_NAMES = [
  "understanding_create",
  "understanding_update",
  "understanding_delete",
  "domain_create",
  "domain_update",
  "domain_delete",
  "context_create",
  "context_update",
  "context_delete",
  "canvas_create",
  "canvas_update",
  "canvas_delete",
] as const;

export const PI_WEB_ACCESS_TOOL_NAMES = [
  "web_search",
  "source_check",
  "fetch_content",
  "get_search_content",
] as const;

export const PI_IMAGE_TOOL_NAMES = ["image_generate"] as const;

/**
 * present（展示）工具与 readonly / approval 不同：模型对临时分析结构做只读展示，
 * 不写入、不审批、不产生 artifact receipt。工具名即 UI 路由；completed output 元数据
 * `kind: "canvas-view", version: 1` 供 Turn Renderer 派生独立 canvas-view 消息块。
 */
export const PI_PRESENT_TOOL_NAMES = ["canvas_present"] as const;

export type PiApprovalToolName = (typeof PI_APPROVAL_TOOL_NAMES)[number];

export type PiToolName =
  | (typeof PI_BUILTIN_TOOL_NAMES)[number]
  | (typeof PI_READ_ONLY_TOOL_NAMES)[number]
  | PiApprovalToolName
  | (typeof PI_WEB_ACCESS_TOOL_NAMES)[number]
  | (typeof PI_IMAGE_TOOL_NAMES)[number]
  | (typeof PI_PRESENT_TOOL_NAMES)[number];

/** 全部工具名（allowlist 拼接顺序）。 */
export const PI_TOOL_NAMES: readonly PiToolName[] = [
  ...PI_BUILTIN_TOOL_NAMES,
  ...PI_READ_ONLY_TOOL_NAMES,
  ...PI_APPROVAL_TOOL_NAMES,
  ...PI_WEB_ACCESS_TOOL_NAMES,
  ...PI_IMAGE_TOOL_NAMES,
  ...PI_PRESENT_TOOL_NAMES,
];

/** 非 approval 工具（直接执行），供 UI 与完整性测试使用。 */
export const PI_PLAIN_TOOL_NAMES: readonly PiToolName[] = PI_TOOL_NAMES.filter(
  (name) => !isPiApprovalToolName(name),
);

/**
 * 出现在 activity group 里的「过程工具」：非 approval，且排除派生独立消息块的交付工具
 * （image_generate -> 图片块，canvas_present -> canvas-view 块）。
 */
export const PI_ACTIVITY_TOOL_NAMES: readonly PiToolName[] = PI_PLAIN_TOOL_NAMES.filter(
  (name) => name !== "image_generate" && name !== "canvas_present",
);

export function isPiApprovalToolName(name: string): name is PiApprovalToolName {
  return PI_APPROVAL_TOOL_NAMES.includes(name as PiApprovalToolName);
}

export function isPiToolName(name: string): name is PiToolName {
  return (PI_TOOL_NAMES as readonly string[]).includes(name);
}

/** 全量工具中文标签（main 注册与 renderer 提案标题同源）。 */
export const PI_TOOL_LABELS: Record<PiToolName, string> = {
  read: "读取文件",
  bash: "执行 Bash",
  edit: "修改文件",
  write: "写入文件",
  domain_list: "列出领域",
  domain_inspect: "查看领域",
  understanding_list: "列出理解",
  understanding_get: "读取理解",
  context_list: "列出上下文",
  context_get: "读取上下文",
  attachment_read: "读取附件",
  retrieve_knowledge: "检索知识",
  canvas_read: "读取画布",
  canvas_list: "列出画布",
  canvas_search: "搜索画布",
  understanding_create: "创建理解",
  understanding_update: "修改理解",
  understanding_delete: "删除理解",
  domain_create: "创建领域",
  domain_update: "修改领域",
  domain_delete: "删除领域",
  context_create: "创建上下文",
  context_update: "修改上下文",
  context_delete: "删除上下文",
  canvas_create: "创建画布",
  canvas_update: "修改画布",
  canvas_delete: "删除画布",
  web_search: "搜索网页",
  source_check: "核验观点",
  fetch_content: "读取网页",
  get_search_content: "读取搜索内容",
  image_generate: "生成图片",
  canvas_present: "展示画布视图",
};
