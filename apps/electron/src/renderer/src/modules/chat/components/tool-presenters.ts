type ToolDetailSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  items?: string[];
};

export type ToolPresentation = {
  summary: string;
  sections: ToolDetailSection[];
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  experience: "经历",
  video: "视频",
  book: "书籍",
  article: "文章",
  opinion: "观点",
  ai: "AI",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function truncate(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

function joinSections(...sections: ToolDetailSection[]): ToolDetailSection[] {
  return sections.filter((section) => section.rows.length > 0 || (section.items?.length ?? 0) > 0);
}

function presentSearchInput(input: Record<string, unknown>): ToolPresentation {
  const query = asString(input.query) ?? "知识库";
  return {
    summary: `搜索「${query}」`,
    sections: joinSections({
      title: "搜索内容",
      rows: [{ label: "关键词", value: query }],
    }),
  };
}

function presentSearchOutput(output: Record<string, unknown>): ToolPresentation {
  const thoughts = Array.isArray(output.thoughts) ? output.thoughts : [];
  const contexts = Array.isArray(output.contexts) ? output.contexts : [];
  const thoughtItems = thoughts
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = asString(row.title) ?? "无标题";
      return truncate(title, 80);
    })
    .filter((item): item is string => !!item);
  const contextItems = contexts
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const snippet = asString(row.snippet) ?? asString(row.sourceName) ?? "Context";
      return truncate(snippet, 100);
    })
    .filter((item): item is string => !!item);

  return {
    summary: `找到 ${thoughtItems.length} 条 Thought · ${contextItems.length} 条 Context`,
    sections: joinSections(
      {
        title: "Thought 结果",
        rows: [],
        items: thoughtItems.length > 0 ? thoughtItems : ["无匹配 Thought"],
      },
      {
        title: "Context 结果",
        rows: [],
        items: contextItems.length > 0 ? contextItems : ["无匹配 Context"],
      },
    ),
  };
}

function presentThoughtDetailInput(input: Record<string, unknown>): ToolPresentation {
  const thoughtId = asString(input.thoughtId) ?? "未知";
  return {
    summary: `查看 Thought · ${thoughtId}`,
    sections: joinSections({
      title: "目标",
      rows: [{ label: "Thought ID", value: thoughtId }],
    }),
  };
}

function presentThoughtDetailOutput(output: Record<string, unknown>): ToolPresentation {
  if (output.found === false) {
    return {
      summary: "未找到 Thought",
      sections: joinSections({
        title: "结果",
        rows: [{ label: "状态", value: "Thought 不存在" }],
      }),
    };
  }

  const title = asString(output.title) ?? "无标题";
  const body = asString(output.body) ?? "";
  const contexts = Array.isArray(output.contexts) ? output.contexts.length : 0;
  const connections = Array.isArray(output.connections) ? output.connections.length : 0;

  return {
    summary: `「${truncate(title, 48)}」· ${contexts} 个 Context · ${connections} 个连接`,
    sections: joinSections(
      {
        title: "Thought",
        rows: [
          { label: "标题", value: title },
          ...(body ? [{ label: "正文", value: truncate(body, 400) }] : []),
        ],
      },
      {
        title: "关联",
        rows: [
          { label: "Context", value: `${contexts} 个` },
          { label: "连接", value: `${connections} 个` },
        ],
      },
    ),
  };
}

function presentGraphInput(input: Record<string, unknown>): ToolPresentation {
  const thoughtId = asString(input.thoughtId) ?? "未知";
  return {
    summary: `查看图谱邻域 · ${thoughtId}`,
    sections: joinSections({
      title: "目标",
      rows: [{ label: "Thought ID", value: thoughtId }],
    }),
  };
}

function presentGraphOutput(output: Record<string, unknown>): ToolPresentation {
  if (output.found === false) {
    return {
      summary: "未找到 Thought",
      sections: joinSections({
        title: "结果",
        rows: [{ label: "状态", value: "Thought 不存在" }],
      }),
    };
  }

  const thought = asRecord(output.thought);
  const title = asString(thought?.title) ?? "无标题";
  const connections = Array.isArray(output.connections) ? output.connections : [];
  const referencedBy = Array.isArray(output.referencedBy) ? output.referencedBy : [];
  const categories = Array.isArray(output.categories) ? output.categories : [];

  const connectionItems = connections
    .map((item) => {
      const row = asRecord(item);
      return row ? truncate(asString(row.title) ?? "无标题", 80) : null;
    })
    .filter((item): item is string => !!item);

  const referencedItems = referencedBy
    .map((item) => {
      const row = asRecord(item);
      return row ? truncate(asString(row.title) ?? "无标题", 80) : null;
    })
    .filter((item): item is string => !!item);

  return {
    summary: `「${truncate(title, 40)}」· ${connectionItems.length} 个出边 · ${referencedItems.length} 个入边`,
    sections: joinSections(
      {
        title: "Thought",
        rows: [{ label: "标题", value: title }],
      },
      {
        title: "分类",
        rows: [],
        items:
          categories.length > 0
            ? categories
                .map((item) => {
                  const row = asRecord(item);
                  return row ? (asString(row.name) ?? asString(row.id) ?? null) : null;
                })
                .filter((item): item is string => !!item)
            : ["无分类"],
      },
      {
        title: "连接出去",
        rows: [],
        items: connectionItems.length > 0 ? connectionItems : ["无连接"],
      },
      {
        title: "被连接",
        rows: [],
        items: referencedItems.length > 0 ? referencedItems : ["无反向连接"],
      },
    ),
  };
}

function presentCreateThoughtInput(input: Record<string, unknown>): ToolPresentation {
  const title = asString(input.title) ?? "新 Thought";
  const body = asString(input.body) ?? "";
  const categoryIds = Array.isArray(input.categoryIds) ? input.categoryIds.length : 0;

  return {
    summary: `创建 Thought「${truncate(title, 48)}」`,
    sections: joinSections({
      title: "将创建",
      rows: [
        { label: "标题", value: title },
        ...(body ? [{ label: "正文", value: truncate(body, 400) }] : []),
        ...(categoryIds > 0 ? [{ label: "分类", value: `${categoryIds} 个` }] : []),
      ],
    }),
  };
}

function presentCreateThoughtOutput(output: Record<string, unknown>): ToolPresentation {
  const title = asString(output.title) ?? "Thought";
  const thoughtId = asString(output.thoughtId);
  return {
    summary: `已创建「${truncate(title, 48)}」`,
    sections: joinSections({
      title: "结果",
      rows: [
        { label: "标题", value: title },
        ...(thoughtId ? [{ label: "Thought ID", value: thoughtId }] : []),
      ],
    }),
  };
}

function presentUpdateThoughtInput(input: Record<string, unknown>): ToolPresentation {
  const thoughtId = asString(input.thoughtId) ?? "未知";
  const title = asString(input.title);
  const body = asString(input.body);
  const changes = [
    ...(title != null ? [`标题 → ${title || "（清空）"}`] : []),
    ...(body != null ? [`正文 → ${truncate(body, 120)}`] : []),
  ];

  return {
    summary: changes.length > 0 ? `更新 Thought · ${changes[0]}` : `更新 Thought · ${thoughtId}`,
    sections: joinSections({
      title: "将更新",
      rows: [
        { label: "Thought ID", value: thoughtId },
        ...(title != null ? [{ label: "新标题", value: title || "（清空）" }] : []),
        ...(body != null ? [{ label: "新正文", value: truncate(body, 400) }] : []),
      ],
    }),
  };
}

function presentUpdateThoughtOutput(output: Record<string, unknown>): ToolPresentation {
  const title = asString(output.title) ?? "Thought";
  return {
    summary: `已更新「${truncate(title, 48)}」`,
    sections: joinSections({
      title: "结果",
      rows: [
        { label: "标题", value: title },
        ...(asString(output.thoughtId)
          ? [{ label: "Thought ID", value: asString(output.thoughtId)! }]
          : []),
      ],
    }),
  };
}

function presentAddContextInput(input: Record<string, unknown>): ToolPresentation {
  const sourceType = asString(input.sourceType);
  const sourceLabel = sourceType ? (SOURCE_TYPE_LABELS[sourceType] ?? sourceType) : "Context";
  const content = asString(input.content) ?? "";
  const sourceName = asString(input.sourceName);

  return {
    summary: `添加 ${sourceLabel}${sourceName ? ` · ${sourceName}` : ""}`,
    sections: joinSections({
      title: "将添加 Context",
      rows: [
        ...(asString(input.thoughtId)
          ? [{ label: "Thought ID", value: asString(input.thoughtId)! }]
          : []),
        { label: "来源类型", value: sourceLabel },
        ...(sourceName ? [{ label: "来源名称", value: sourceName }] : []),
        ...(content ? [{ label: "内容", value: truncate(content, 400) }] : []),
      ],
    }),
  };
}

function presentAddContextOutput(output: Record<string, unknown>): ToolPresentation {
  return {
    summary: "Context 已添加",
    sections: joinSections({
      title: "结果",
      rows: [
        ...(asString(output.thoughtId)
          ? [{ label: "Thought ID", value: asString(output.thoughtId)! }]
          : []),
        ...(asString(output.contextId)
          ? [{ label: "Context ID", value: asString(output.contextId)! }]
          : []),
      ],
    }),
  };
}

function presentCreateConnectionInput(input: Record<string, unknown>): ToolPresentation {
  const sourceId = asString(input.sourceId) ?? "未知";
  const targetId = asString(input.targetId) ?? "未知";
  return {
    summary: `创建连接 ${sourceId} → ${targetId}`,
    sections: joinSections({
      title: "将创建连接",
      rows: [
        { label: "来源", value: sourceId },
        { label: "目标", value: targetId },
      ],
    }),
  };
}

function presentCreateConnectionOutput(output: Record<string, unknown>): ToolPresentation {
  const sourceId = asString(output.sourceId) ?? "未知";
  const targetId = asString(output.targetId) ?? "未知";
  return {
    summary: `已连接 ${sourceId} → ${targetId}`,
    sections: joinSections({
      title: "结果",
      rows: [
        { label: "来源", value: sourceId },
        { label: "目标", value: targetId },
      ],
    }),
  };
}

function presentRejectedOutput(
  output: Record<string, unknown> | null,
  errorText?: string,
): ToolPresentation {
  const message =
    asString(output?.message) ??
    asString(errorText) ??
    (output?.rejected ? "用户拒绝了此操作" : "操作未完成");
  return {
    summary: "已拒绝",
    sections: joinSections({
      title: "结果",
      rows: [{ label: "说明", value: message }],
    }),
  };
}

function presentGeneric(
  toolLabel: string,
  input: Record<string, unknown> | null,
  output: Record<string, unknown> | null,
): ToolPresentation {
  const inputRows = input
    ? Object.entries(input)
        .map(([key, value]) => {
          const text =
            asString(value) ?? (value != null ? truncate(JSON.stringify(value), 120) : undefined);
          return text ? { label: key, value: text } : null;
        })
        .filter((row): row is { label: string; value: string } => !!row)
    : [];

  const outputRows = output
    ? Object.entries(output)
        .map(([key, value]) => {
          const text =
            asString(value) ?? (value != null ? truncate(JSON.stringify(value), 120) : undefined);
          return text ? { label: key, value: text } : null;
        })
        .filter((row): row is { label: string; value: string } => !!row)
    : [];

  return {
    summary: toolLabel,
    sections: joinSections(
      ...(inputRows.length > 0 ? [{ title: "请求", rows: inputRows }] : []),
      ...(outputRows.length > 0 ? [{ title: "结果", rows: outputRows }] : []),
    ),
  };
}

const INPUT_PRESENTERS: Record<string, (input: Record<string, unknown>) => ToolPresentation> = {
  search_knowledge_base: presentSearchInput,
  get_thought_detail: presentThoughtDetailInput,
  get_graph_neighborhood: presentGraphInput,
  propose_create_thought: presentCreateThoughtInput,
  propose_update_thought: presentUpdateThoughtInput,
  propose_add_context: presentAddContextInput,
  propose_create_connection: presentCreateConnectionInput,
};

const OUTPUT_PRESENTERS: Record<string, (output: Record<string, unknown>) => ToolPresentation> = {
  search_knowledge_base: presentSearchOutput,
  get_thought_detail: presentThoughtDetailOutput,
  get_graph_neighborhood: presentGraphOutput,
  propose_create_thought: presentCreateThoughtOutput,
  propose_update_thought: presentUpdateThoughtOutput,
  propose_add_context: presentAddContextOutput,
  propose_create_connection: presentCreateConnectionOutput,
};

export function presentToolCall(options: {
  toolName: string;
  toolLabel: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state: string;
}): ToolPresentation {
  const input = asRecord(options.input);
  const output = asRecord(options.output);
  const inputPresentation = input
    ? (INPUT_PRESENTERS[options.toolName]?.(input) ??
      presentGeneric(options.toolLabel, input, null))
    : null;

  if (options.state === "output-error" || output?.rejected === true) {
    return presentRejectedOutput(output, options.errorText);
  }

  if (output) {
    return (
      OUTPUT_PRESENTERS[options.toolName]?.(output) ??
      presentGeneric(options.toolLabel, input, output)
    );
  }

  if (options.errorText) {
    return {
      summary: truncate(options.errorText, 80),
      sections: joinSections({
        title: "错误",
        rows: [{ label: "说明", value: options.errorText }],
      }),
    };
  }

  if (options.state === "approval-responded") {
    return {
      summary: "正在执行…",
      sections: inputPresentation?.sections ?? [],
    };
  }

  if (options.state === "output-denied") {
    return presentRejectedOutput(null, "用户拒绝了此操作");
  }

  if (inputPresentation) {
    return inputPresentation;
  }

  return {
    summary: options.toolLabel,
    sections: [],
  };
}
