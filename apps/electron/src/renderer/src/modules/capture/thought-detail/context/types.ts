import { Bot, BookOpen, FileText, MessageCircle, User, Video } from "lucide-react";
import { SourceType } from "@shared/context";

export const SOURCE_META: Record<SourceType, { label: string; Icon: typeof User }> = {
  experience: { label: "个人经历", Icon: User },
  video: { label: "视频", Icon: Video },
  book: { label: "书籍", Icon: BookOpen },
  article: { label: "文章", Icon: FileText },
  opinion: { label: "他人观点", Icon: MessageCircle },
  ai: { label: "AI 生成", Icon: Bot },
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
