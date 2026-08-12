import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// DESIGN: 项目自定义排版 token（tokens.css 的 --text-body/body-small/body-large）
// 不在 tailwind-merge 默认 font-size 白名单，会被误判为 text-color，与
// text-muted-foreground/text-foreground 同组冲突合并、字号类被丢弃（实际渲染
// 退回继承 14px）。显式并入 font-size 组，与颜色组互不冲突。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["body", "body-small", "body-large"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
