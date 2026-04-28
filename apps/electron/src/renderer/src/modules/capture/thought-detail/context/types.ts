import { SourceType } from "@shared/context";

export const SOURCE_META: Record<SourceType, { label: string; icon: string }> = {
  experience: { label: "个人经历", icon: "pi pi-user" },
  video: { label: "视频", icon: "pi pi-youtube" },
  book: { label: "书籍", icon: "pi pi-book" },
  article: { label: "文章", icon: "pi pi-file-word" },
  opinion: { label: "他人观点", icon: "pi pi-comments" },
  ai: { label: "AI 生成", icon: "pi pi-microchip-ai" },
};

export const SOURCE_PLACEHOLDER: Record<SourceType, string> = {
  experience: "",
  video: "视频标题 / 频道名",
  book: "书名 + 章节",
  article: "文章标题 / 来源",
  opinion: "姓名 / 来源",
  ai: "简要描述内容来源，选填",
};

export const SOURCE_TYPES: SourceType[] = [
  "experience",
  "video",
  "book",
  "article",
  "opinion",
  "ai",
];
