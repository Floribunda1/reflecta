/** 附件元数据格式化（composer 预览 + 消息展示共用）。 */

export function formatBytes(bytes: number | undefined): string | undefined {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 附件类型标签：从文件名取扩展名（TS / PY / PDF），不依赖 MIME（代码文件 MIME 常为空）。 */
export function fileExtensionLabel(filename: string): string {
  const extension = filename.split(".").pop()?.toUpperCase();
  if (!extension || extension === filename.toUpperCase()) return "文件";
  return extension;
}

/** 组装 shadcn 风格描述行：`TS · 2.4 KB`。 */
export function attachmentMeta(filename: string, size: number | undefined): string {
  return [fileExtensionLabel(filename), formatBytes(size)].filter(Boolean).join(" · ");
}

/** 常见文件扩展名 → MIME 推断（File.type 对代码文件常为空字符串）。 */
const EXTENSION_MEDIA_TYPES: Record<string, string> = {
  ts: "text/typescript",
  tsx: "text/typescript",
  mts: "text/typescript",
  js: "text/javascript",
  jsx: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  py: "text/x-python",
  rb: "text/x-ruby",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++",
  hpp: "text/x-c++",
  cs: "text/x-csharp",
  php: "text/x-php",
  swift: "text/x-swift",
  kt: "text/x-kotlin",
  sh: "text/x-shellscript",
  bash: "text/x-shellscript",
  zsh: "text/x-shellscript",
  json: "application/json",
  yml: "text/yaml",
  yaml: "text/yaml",
  toml: "text/toml",
  xml: "text/xml",
  css: "text/css",
  scss: "text/x-scss",
  html: "text/html",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  log: "text/plain",
  sql: "text/x-sql",
  graphql: "text/x-graphql",
  csv: "text/csv",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  svg: "image/svg+xml",
};

/** 附件 mediaType：File.type 优先；空时按扩展名推断——仅用于发送给 AI 的
 *  元数据（如 text/typescript），前端展示走 fileExtensionLabel（文件名扩展名）。 */
export function inferMediaType(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension
    ? (EXTENSION_MEDIA_TYPES[extension] ?? "application/octet-stream")
    : "application/octet-stream";
}
