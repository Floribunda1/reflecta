import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ListChecks,
  MessageCircleDashed,
} from "lucide-react";
import { cn } from "#lib/utils";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible";
import { AgentExecutionBlock } from "./execution/agent-execution-block";
import type { AgentActivityBlockView } from "./execution/types";

const variants = [
  { id: "control", label: "控件条" },
  { id: "lane", label: "执行轨道" },
  { id: "receipt", label: "过程回执" },
] as const;

type VariantId = (typeof variants)[number]["id"];

const activityBlocks: AgentActivityBlockView[] = [
  {
    kind: "reasoning",
    reasoning: {
      id: "prototype-reasoning",
      status: "done",
      markdown: "先查看 AI Coding Domain 的现有内容，确认已有知识的范围。",
    },
  },
  {
    kind: "tool-activity",
    activity: {
      id: "prototype-domain-inspect",
      toolName: "domain-inspect",
      status: "done",
      summary: "查看了 Domain「AI Coding」",
      items: [
        {
          id: "prototype-domain-inspect-item",
          label: "查看了 Domain「AI Coding」",
          details: {
            badges: ["1 条 Understanding", "0 条 Context"],
          },
        },
      ],
    },
  },
];

function ActivityDetails({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-1 py-2", className)}>
      {activityBlocks.map((block) => (
        <AgentExecutionBlock
          key={block.kind === "reasoning" ? block.reasoning.id : block.activity.id}
          block={block}
        />
      ))}
    </div>
  );
}

function ControlStrip() {
  return (
    <Collapsible className="group/activity min-w-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg bg-muted/45 px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-muted/70">
        <Badge
          variant="secondary"
          className="h-5 min-w-7 justify-center rounded-full px-2 font-semibold tabular-nums"
        >
          2
        </Badge>
        <span className="min-w-0 flex-1 truncate">
          查看了「AI Coding」Domain · 1 条 Understanding
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ActivityDetails className="ml-3 border-l border-border/60 pl-4" />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActivityLane() {
  return (
    <Collapsible className="group/activity relative min-w-0 pl-4">
      <span className="absolute inset-y-1 left-0 w-px bg-border" aria-hidden="true" />
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ListChecks className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          查看了「AI Coding」Domain · 1 条 Understanding
        </span>
        <Badge
          variant="outline"
          className="h-5 min-w-7 justify-center rounded-full px-2 font-semibold tabular-nums"
        >
          2
        </Badge>
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ActivityDetails />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProcessReceipt() {
  return (
    <Collapsible className="group/activity min-w-0 rounded-xl border border-border/70 px-3">
      <CollapsibleTrigger className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <MessageCircleDashed className="size-4" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground">2 个执行步骤</span>
          <span className="truncate text-sm text-foreground/80">
            查看了「AI Coding」Domain · 1 条 Understanding
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/activity:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ActivityDetails className="border-t border-border/60" />
      </CollapsibleContent>
    </Collapsible>
  );
}

function VariantActivity({ variant }: { variant: VariantId }) {
  if (variant === "lane") return <ActivityLane />;
  if (variant === "receipt") return <ProcessReceipt />;
  return <ControlStrip />;
}

function DemoConversation({ variant }: { variant: VariantId }) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-8 px-8 py-16">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <MessageCircleDashed className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          用户想聊聊最近 vibe coding 的实践，并把新的认识沉淀到 AI Coding Domain。
        </span>
      </div>

      <div className="grid gap-7 text-[17px] leading-8">
        <p>好的，我先看看 AI Coding 里已经有哪些知识，再接着聊你的实际经历。</p>

        <VariantActivity variant={variant} />

        <div className="grid gap-5">
          <p>
            AI Coding 里现在有一条关于代码修改目标的 Understanding，重点是保持整体架构干净。
            我已经了解现有内容了，你可以从最近一次让你印象深刻的实践开始说。
          </p>
          <p>我会先和你一起把判断背后的经历讲清楚；等结论足够稳定，再由你确认是否写入知识库。</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">7月31日 10:42:18</p>
    </main>
  );
}

function ActivityHierarchyPrototype() {
  const [variantIndex, setVariantIndex] = useState(() => {
    const selected = new URLSearchParams(window.location.search).get("activityVariant");
    const index = variants.findIndex((variant) => variant.id === selected);
    return index >= 0 ? index : 0;
  });

  const selectVariant = (nextIndex: number) => {
    const normalized = (nextIndex + variants.length) % variants.length;
    setVariantIndex(normalized);
    const url = new URL(window.location.href);
    url.searchParams.set("activityVariant", variants[normalized].id);
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") selectVariant(variantIndex - 1);
      if (event.key === "ArrowRight") selectVariant(variantIndex + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variantIndex]);

  const variant = variants[variantIndex];

  return (
    <>
      <DemoConversation variant={variant.id} />
      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <div className="flex items-center gap-1 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="上一个方案"
            onClick={() => selectVariant(variantIndex - 1)}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-32 px-3 text-center text-sm font-medium">
            {variantIndex + 1} / {variants.length} · {variant.label}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="下一个方案"
            onClick={() => selectVariant(variantIndex + 1)}
          >
            <ArrowRight />
          </Button>
        </div>
      </div>
    </>
  );
}

const meta = {
  title: "Agent/Prototype/Activity 与正文层级",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compare: Story = {
  name: "三种结构",
  render: () => <ActivityHierarchyPrototype />,
};
