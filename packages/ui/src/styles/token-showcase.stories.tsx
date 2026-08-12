import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";

/**
 * Design Tokens 总览（Styles / Design Tokens）
 *
 * 只展示「系统定义的 design tokens」——tokens.css 中的语义 token 与比例尺。
 * 语义 token 从 :root / .dark 变量实时读取（随 Storybook 主题切换刷新）；
 * 比例尺（圆角/排版）以 utility 效果展示。
 *
 * 结构：shadcn 接口层（契约名，不可改）+ 状态色家族（社区标准扩展，OKLCH 派生）。
 * 主题选择（Ghostty 配对主题）可在工具栏切换。
 */

const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
] as const;

const STATUS_TOKENS = [
  "success",
  "success-foreground",
  "success-muted",
  "warning",
  "warning-foreground",
  "warning-muted",
  "info",
  "info-foreground",
  "info-muted",
  "danger",
  "danger-foreground",
  "danger-muted",
] as const;

const CHART_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

function useTokenValues(names: readonly string[]) {
  const { resolvedTheme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of names) next[name] = styles.getPropertyValue(`--${name}`).trim() || "—";
    setValues(next);
  }, [resolvedTheme, names.join("|")]);

  return values;
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid grid-cols-[3rem_1fr] items-center gap-3">
      <div
        className="size-12 rounded-md border border-border"
        style={{ backgroundColor: `var(--${name})` }}
      />
      <div className="min-w-0">
        <div className="truncate font-mono text-xs">--{name}</div>
        <div className="truncate text-xs text-muted-foreground" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function TokenGrid({ names }: { names: readonly string[] }) {
  const values = useTokenValues(names);
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {names.map((name) => (
        <Swatch key={name} name={name} value={values[name] ?? "—"} />
      ))}
    </div>
  );
}

const TYPE_SAMPLES = [
  { label: "text-body-large", className: "text-body-large" },
  { label: "text-body", className: "text-body" },
  { label: "text-body-small", className: "text-body-small" },
] as const;

const RADIUS_CLASSES = [
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-full",
] as const;

export default {
  title: "Styles/Design Tokens",
  parameters: {
    layout: "fullscreen",
    options: { showPanel: false },
  },
};

export function Overview() {
  return (
    <StoryShowcase
      title="Design Tokens"
      description="系统定义的 design tokens 实时总览（tokens.css）。语义 token 随工具栏主题切换显示 light/dark 取值；比例尺以 utility 效果展示。"
    >
      <StoryCase
        title="语义颜色（shadcn 接口层）"
        description="shadcn 组件契约名，值映射 Base16 槽位；card/popover 与 background 同色，层级靠 shadow/ring。"
      >
        <TokenGrid names={COLOR_TOKENS} />
      </StoryCase>

      <StoryCase
        title="状态色家族"
        description="社区标准扩展：实色直接引用彩色槽位；foreground 用 OKLCH mix 到正文色（自适应明暗）；muted 用 OKLCH mix 到画布色（淡底）。"
      >
        <TokenGrid names={STATUS_TOKENS} />
      </StoryCase>

      <StoryCase title="图表色" description="chart-1~5，数据可视化专用（图表内语义，不进 UI）。">
        <TokenGrid names={CHART_TOKENS} />
      </StoryCase>

      <StoryCase
        title="排版档位"
        description="排版：body（14px，chat 正文基线）+ body-large + body-small（12px）。"
      >
        <div className="grid gap-3">
          {TYPE_SAMPLES.map((sample) => (
            <div key={sample.label} className="flex items-baseline gap-4">
              <span className="w-44 shrink-0 truncate font-mono text-xs text-muted-foreground">
                {sample.label}
              </span>
              <span className={sample.className}>Reflecta Aa 123</span>
            </div>
          ))}
        </div>
      </StoryCase>

      <StoryCase title="圆角" description="radius 档位（--radius 基数派生：sm → 2xl / full）。">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {RADIUS_CLASSES.map((className) => (
            <div key={className} className="grid gap-1">
              <div className={`h-12 border border-border bg-muted ${className}`} />
              <span className="font-mono text-xs text-muted-foreground">{className}</span>
            </div>
          ))}
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}
