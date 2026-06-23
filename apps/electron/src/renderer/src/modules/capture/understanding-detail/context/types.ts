import { Bot, BookOpen, FileText, MessageCircle, User, Video } from "lucide-react";
import { ContextMedium } from "@shared/context";

export const CONTEXT_META: Record<ContextMedium, { label: string; Icon: typeof User }> = {
  experience: { label: "个人经历", Icon: User },
  video: { label: "视频", Icon: Video },
  book: { label: "书籍", Icon: BookOpen },
  article: { label: "文章", Icon: FileText },
  opinion: { label: "他人观点", Icon: MessageCircle },
  ai: { label: "AI 生成", Icon: Bot },
  other: { label: "其他", Icon: FileText },
};

export const CONTEXT_PLACEHOLDER: Record<ContextMedium, string> = {
  experience: "",
  video: "视频标题 / 频道名",
  book: "书名 + 章节",
  article: "文章标题 / 平台",
  opinion: "姓名 / 场景",
  ai: "简要描述上下文，选填",
  other: "简要描述上下文，选填",
};

export const CONTEXT_TYPES: ContextMedium[] = [
  "experience",
  "video",
  "book",
  "article",
  "opinion",
  "ai",
  "other",
];
