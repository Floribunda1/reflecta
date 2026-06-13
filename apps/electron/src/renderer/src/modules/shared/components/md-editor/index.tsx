import { useEffect, useState } from "react";
import "./milkdown-theme.css";

type MarkdownEditorProps = {
  content?: string;
  width?: number | string;
  height?: number | string;
  enableWikiLink?: boolean;
  onUpdate?: (value: string) => void;
};

export function MarkdownEditor({ content = "", height = 400, onUpdate }: MarkdownEditorProps) {
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  return (
    <div
      className="milkdown-editor"
      style={{
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      <textarea
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          onUpdate?.(next);
        }}
        placeholder="请输入"
        className="h-full w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
