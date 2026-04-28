import { computed, defineComponent, ref } from "vue";

type JourneyKey = "clarify" | "insight" | "explore";

type Entry = {
  title: string;
  meta: string;
  body: string;
};

type Message = {
  role: "user" | "assistant" | "system";
  meta: string;
  body: string;
};

type Preview = {
  type: string;
  title: string;
  summary: string;
  detail: string;
};

type Journey = {
  key: JourneyKey;
  icon: string;
  eyebrow: string;
  title: string;
  trigger: string;
  anchor: string;
  hostTitle: string;
  hostSubtitle: string;
  hostMode: "Thought 编辑区" | "Category 浏览区" | "节点详情区";
  prompt: string;
  contextChips: string[];
  messages: Message[];
  preview: Preview;
  primaryItems: Entry[];
  sideItems: Entry[];
};

const journeys: Journey[] = [
  {
    key: "clarify",
    icon: "pi pi-sparkles",
    eyebrow: "Journey 1",
    title: "苏格拉底澄清",
    trigger: "深化",
    anchor: "热爱是高效前进的强驱动力",
    hostTitle: "热爱到底是什么状态？",
    hostSubtitle: "Capture / Thought 编辑区",
    hostMode: "Thought 编辑区",
    prompt: "我觉得它和身份认同有关。继续追问，先不要保存任何东西。",
    contextChips: ["Pinned: 当前 Thought", "@身份认同影响行动力", "Context: 低内耗", "草稿保留"],
    primaryItems: [
      {
        title: "正文",
        meta: "正在编辑",
        body: "热爱是高效前进的强驱动力。它让人更容易投入长期行动，也更少感到自己是在强迫自己。",
      },
      {
        title: "Context",
        meta: "2 条",
        body: "交易复盘会累，但不像被迫完成任务；真正让我持续的是低内耗和身份认同，而不只是兴趣。",
      },
    ],
    sideItems: [
      {
        title: "身份认同影响行动力",
        meta: "@Thought",
        body: "当行为和“我是谁”一致时，开始行动更少依赖意志力。",
      },
      {
        title: "低内耗不是轻松",
        meta: "Related Context",
        body: "稳定推进通常来自阻力降低，而不是更强的自控。",
      },
    ],
    messages: [
      {
        role: "assistant",
        meta: "第一条追问",
        body: "你说的“热爱”更像哪一种状态：被内容吸引、觉得它有意义、做的时候低内耗，还是愿意长期重复？",
      },
      {
        role: "user",
        meta: "补充个人体验",
        body: "更接近低内耗和愿意反复做。研究交易复盘会很累，但不会觉得是在强迫自己。",
      },
      {
        role: "assistant",
        meta: "阶段性理解",
        body: "那这条 Thought 可能不是在说“喜欢带来高效率”，而是在说：当一件事和身份认同一致时，行动阻力会更低，因此更容易长期推进。",
      },
    ],
    preview: {
      type: "补充正文",
      title: "建议变更预览",
      summary: "把“热爱”收窄为身份认同带来的低内耗，而不是泛泛的喜欢。",
      detail:
        "当一件事与我的身份认同一致时，我推进它的内耗会更低。这里的“热爱”不是轻松或兴奋，而是愿意在疲惫时继续重复，并且不觉得自己在违背内心。",
    },
  },
  {
    key: "insight",
    icon: "pi pi-chart-scatter",
    eyebrow: "Journey 2",
    title: "洞察挖掘",
    trigger: "洞察",
    anchor: "交易心理",
    hostTitle: "交易心理这组笔记在说什么？",
    hostSubtitle: "Capture / Category 浏览区",
    hostMode: "Category 浏览区",
    prompt: "第 2 个角度有意思。帮我判断它是否真的能解释这些笔记。",
    contextChips: ["Scope: 15 条 Thought", "共同主题", "张力矛盾", "可沉淀 Insight"],
    primaryItems: [
      {
        title: "恐惧来自仓位失控",
        meta: "Thought",
        body: "亏损本身不是最可怕的，不知道亏损会扩大到哪里才是恐惧的来源。",
      },
      {
        title: "止损纪律不是勇气问题",
        meta: "Thought",
        body: "临场执行失败常常不是不知道规则，而是规则没有提前转化成可承受的行动边界。",
      },
      {
        title: "贪婪让人忽略退出标准",
        meta: "Thought",
        body: "盈利时最难做的是承认机会已经结束，而不是继续寻找留下来的理由。",
      },
    ],
    sideItems: [
      {
        title: "共同主题",
        meta: "Observation",
        body: "这些记录都在处理不确定情境下的行动边界，而不只是情绪管理。",
      },
      {
        title: "共同前提",
        meta: "Observation",
        body: "用户默认“临场状态不可靠”，所以系统要在临场前降低选择成本。",
      },
      {
        title: "张力矛盾",
        meta: "Observation",
        body: "规则越清晰越能降低恐惧，但过度规则化也会让用户错过真实变化。",
      },
    ],
    messages: [
      {
        role: "system",
        meta: "分析进度",
        body: "正在阅读 15 条记录，并按共同主题、共同前提、张力矛盾和可抽象洞察分组。",
      },
      {
        role: "assistant",
        meta: "多维观察",
        body: "这组笔记可以从三个方向理解：情绪不是原因而是信号；纪律不是自控而是预先设计；交易计划的核心是让临场动作可承受。",
      },
      {
        role: "user",
        meta: "选择方向",
        body: "我想继续看“纪律不是自控而是预先设计”这个方向。",
      },
    ],
    preview: {
      type: "创建 Insight",
      title: "Insight Thought 预览",
      summary: "把 15 条交易心理笔记沉淀为一个结构性发现。",
      detail:
        "交易纪律的重点不是在临场拥有更强意志力，而是在临场前把可承受的亏损、退出条件和复盘动作设计清楚，让执行时需要做的选择更少。",
    },
  },
  {
    key: "explore",
    icon: "pi pi-sitemap",
    eyebrow: "Journey 3",
    title: "问题导向探索",
    trigger: "探索",
    anchor: "身份认同",
    hostTitle: "身份认同能解决什么问题？",
    hostSubtitle: "Contemplate / 节点详情区",
    hostMode: "节点详情区",
    prompt: "身份认同和行动力有什么关系？给我几条不同路径。",
    contextChips: ["Node: 身份认同", "Connection: 行动力", "发散路径", "新 Thought 预览"],
    primaryItems: [
      {
        title: "节点说明",
        meta: "Concept",
        body: "身份认同描述的是用户对“我是谁”的稳定叙述，它会影响哪些行为被感知为自然、哪些行为被感知为消耗。",
      },
      {
        title: "已有 Connection",
        meta: "3 条",
        body: "身份认同 -> 行动力；身份认同 -> 低内耗；身份认同 -> 长期主义。",
      },
    ],
    sideItems: [
      {
        title: "路径 A",
        meta: "行动阻力",
        body: "如果行为和身份叙述一致，启动阻力可能更低。",
      },
      {
        title: "路径 B",
        meta: "目标稳定性",
        body: "身份叙述可能让目标不再只依赖短期情绪。",
      },
      {
        title: "路径 C",
        meta: "环境选择",
        body: "身份认同也可能影响用户主动选择什么环境和反馈。",
      },
    ],
    messages: [
      {
        role: "assistant",
        meta: "路径推荐",
        body: "可以沿三条路径探索：身份认同降低启动阻力；身份认同提高目标稳定性；身份认同影响你会选择什么环境来支持行动。",
      },
      {
        role: "user",
        meta: "追问",
        body: "我对第一条更感兴趣，因为它能解释为什么有些事我不需要逼自己。",
      },
      {
        role: "assistant",
        meta: "涌现判断",
        body: "这里浮现出一个可记录观点：行动力并不总是来自更强控制，也可能来自行为与自我叙述之间的摩擦变小。",
      },
    ],
    preview: {
      type: "添加 Connection",
      title: "新 Thought / Connection 预览",
      summary: "记录一个新观点，并连接到“身份认同”和“行动力”。",
      detail:
        "行动力的一部分来源不是自控增强，而是身份认同让某些行为变得更像“我本来就会做的事”。建议连接：身份认同 -> 低行动阻力 -> 长期行动。",
    },
  },
];

const journeyMap = Object.fromEntries(journeys.map((item) => [item.key, item])) as Record<
  JourneyKey,
  Journey
>;

const toneByRole: Record<Message["role"], string> = {
  assistant: "border-surface-200 bg-surface-0",
  user: "ml-8 border-primary-100 bg-primary-50/70",
  system: "border-amber-200 bg-amber-50/80",
};

const HostCard = defineComponent<{ item: Entry; muted?: boolean }>({
  name: "HostCard",
  props: {
    item: { type: Object as () => Entry, required: true },
    muted: { type: Boolean, default: false },
  },
  setup(props) {
    return () => (
      <article
        class={[
          "rounded-md border p-4",
          props.muted ? "border-surface-200 bg-surface-50" : "border-surface-200 bg-surface-0",
        ]}
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-[13px] font-semibold text-color">{props.item.title}</h3>
          <span class="shrink-0 text-[12px] text-muted-color">{props.item.meta}</span>
        </div>
        <p class="mt-3 text-[13px] leading-6 text-color">{props.item.body}</p>
      </article>
    );
  },
});

const MessageBubble = defineComponent<{ message: Message }>({
  name: "MessageBubble",
  props: {
    message: { type: Object as () => Message, required: true },
  },
  setup(props) {
    return () => (
      <article class={["rounded-md border p-4", toneByRole[props.message.role]]}>
        <div class="flex items-center justify-between gap-3">
          <span class="text-[12px] font-semibold text-color">
            {props.message.role === "assistant"
              ? "Reflecta"
              : props.message.role === "user"
                ? "用户"
                : "系统"}
          </span>
          <span class="text-[12px] text-muted-color">{props.message.meta}</span>
        </div>
        <p class="mt-2 text-[13px] leading-6 text-color">{props.message.body}</p>
      </article>
    );
  },
});

export const V2WireframePage = defineComponent({
  name: "V2WireframePage",
  setup() {
    const activeKey = ref<JourneyKey>("clarify");
    const panelOpen = ref(true);
    const previewOpen = ref(true);
    const applied = ref(false);
    const activeJourney = computed(() => journeyMap[activeKey.value]);

    const selectJourney = (key: JourneyKey) => {
      activeKey.value = key;
      panelOpen.value = true;
      previewOpen.value = true;
      applied.value = false;
    };

    return () => {
      const journey = activeJourney.value;

      return (
        <main class="flex h-full min-h-0 w-full overflow-hidden bg-surface-50">
          <aside class="flex w-[292px] shrink-0 flex-col overflow-hidden border-r border-surface-200 bg-surface-0">
            <header class="shrink-0 border-b border-surface-200 px-4 py-4">
              <p class="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-color">
                Reflecta V2
              </p>
              <h1 class="mt-1 text-[20px] font-semibold text-color">Deepen Wireframe</h1>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <div class="space-y-2">
                {journeys.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    class={[
                      "w-full rounded-md border p-3 text-left transition",
                      activeKey.value === item.key
                        ? "border-primary-200 bg-primary-50 text-color"
                        : "border-surface-200 bg-surface-0 text-color hover:bg-surface-50",
                    ]}
                    onClick={() => selectJourney(item.key)}
                  >
                    <div class="flex items-start gap-3">
                      <span
                        class={[
                          item.icon,
                          "mt-0.5 text-[15px]",
                          activeKey.value === item.key ? "text-primary-600" : "text-muted-color",
                        ]}
                      />
                      <span class="min-w-0">
                        <span class="block text-[12px] text-muted-color">{item.eyebrow}</span>
                        <span class="mt-1 block text-[14px] font-semibold">{item.title}</span>
                        <span class="mt-2 block text-[12px] leading-5 text-muted-color">
                          {item.hostSubtitle}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <section class="mt-5 rounded-md border border-surface-200 bg-surface-50 p-3">
                <h2 class="text-[13px] font-semibold text-color">Wireframe states</h2>
                <div class="mt-3 space-y-2 text-[12px] text-muted-color">
                  <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-emerald-500" />
                    嵌入宿主工作区，不跳页
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-blue-500" />
                    对话历史绑定当前对象
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-amber-500" />
                    写入前只显示预览
                  </div>
                </div>
              </section>
            </div>
          </aside>

          <section class="flex min-w-0 flex-1 overflow-hidden">
            <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
              <header class="shrink-0 border-b border-surface-200 bg-surface-0 px-6 py-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="text-[12px] text-muted-color">{journey.hostMode}</p>
                    <h2 class="mt-1 truncate text-[19px] font-semibold text-color">
                      {journey.hostTitle}
                    </h2>
                    <p class="mt-1 text-[13px] text-muted-color">当前锚点：{journey.anchor}</p>
                  </div>
                  <button
                    type="button"
                    class={[
                      "inline-flex shrink-0 items-center gap-2 rounded border px-3 py-2 text-[13px] font-semibold",
                      panelOpen.value
                        ? "border-primary-200 bg-primary-50 text-primary-700"
                        : "border-surface-300 bg-surface-0 text-color hover:bg-surface-50",
                    ]}
                    onClick={() => (panelOpen.value = !panelOpen.value)}
                  >
                    <i class="pi pi-sparkles text-[13px]" />
                    {journey.trigger}
                  </button>
                </div>
              </header>

              <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div class="mx-auto max-w-[860px]">
                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <section class="min-w-0 space-y-4">
                      {journey.primaryItems.map((item) => (
                        <HostCard key={item.title} item={item} />
                      ))}

                      {applied.value && (
                        <section class="rounded-md border border-primary-200 bg-primary-50 p-4 shadow-sm">
                          <div class="flex items-center gap-2 text-[12px] font-semibold text-primary-700">
                            <i class="pi pi-check text-[12px]" />
                            已填充到编辑区
                          </div>
                          <p class="mt-3 text-[13px] leading-6 text-color">
                            {journey.preview.detail}
                          </p>
                        </section>
                      )}
                    </section>

                    <aside class="space-y-3">
                      {journey.sideItems.map((item) => (
                        <HostCard key={item.title} item={item} muted />
                      ))}
                    </aside>
                  </div>
                </div>
              </div>
            </section>

            {panelOpen.value && (
              <aside class="flex w-[42%] min-w-[420px] max-w-[560px] shrink-0 flex-col overflow-hidden border-l border-surface-200 bg-surface-0 shadow-[rgba(0,0,0,0.05)_-12px_0_28px]">
                <header class="shrink-0 border-b border-surface-200 px-4 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-[12px] text-muted-color">AI 面板锚定对象</p>
                      <h2 class="mt-1 truncate text-[16px] font-semibold text-color">
                        {journey.anchor}
                      </h2>
                    </div>
                    <div class="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        class="rounded p-2 text-muted-color hover:bg-surface-50 hover:text-color"
                        title="清空对话"
                      >
                        <i class="pi pi-trash text-[13px]" />
                      </button>
                      <button
                        type="button"
                        class="rounded p-2 text-muted-color hover:bg-surface-50 hover:text-color"
                        title="收起面板，对话将保留"
                        onClick={() => (panelOpen.value = false)}
                      >
                        <i class="pi pi-times text-[13px]" />
                      </button>
                    </div>
                  </div>

                  <div class="mt-3 flex flex-wrap gap-2">
                    {journey.contextChips.map((chip) => (
                      <span
                        key={chip}
                        class="rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-[12px] text-muted-color"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </header>

                <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div class="space-y-3">
                    {journey.messages.map((message, index) => (
                      <MessageBubble key={`${message.meta}-${index}`} message={message} />
                    ))}

                    <article class="rounded-md border border-dashed border-primary-200 bg-primary-50/50 p-4">
                      <button
                        type="button"
                        class="flex w-full items-start justify-between gap-4 text-left"
                        onClick={() => (previewOpen.value = !previewOpen.value)}
                      >
                        <span class="min-w-0">
                          <span class="inline-flex items-center rounded bg-primary-100 px-2 py-1 text-[12px] font-semibold text-primary-700">
                            {journey.preview.type}
                          </span>
                          <span class="mt-3 block text-[14px] font-semibold text-color">
                            {journey.preview.title}
                          </span>
                          <span class="mt-2 block text-[13px] leading-5 text-color">
                            {journey.preview.summary}
                          </span>
                        </span>
                        <i
                          class={[
                            "pi text-[13px] text-muted-color",
                            previewOpen.value ? "pi-chevron-up" : "pi-chevron-down",
                          ]}
                        />
                      </button>

                      {previewOpen.value && (
                        <div class="mt-4 border-t border-primary-100 pt-4">
                          <p class="text-[13px] leading-6 text-color">{journey.preview.detail}</p>
                          <button
                            type="button"
                            class={[
                              "mt-4 inline-flex items-center gap-2 rounded border px-3 py-2 text-[13px] font-semibold",
                              applied.value
                                ? "border-surface-200 bg-surface-100 text-muted-color"
                                : "border-primary-300 bg-surface-0 text-primary-700 hover:bg-primary-50",
                            ]}
                            disabled={applied.value}
                            onClick={() => (applied.value = true)}
                          >
                            <i
                              class={[
                                "pi text-[12px]",
                                applied.value ? "pi-check" : "pi-file-edit",
                              ]}
                            />
                            {applied.value ? "已应用" : "应用到编辑区"}
                          </button>
                        </div>
                      )}
                    </article>

                    <div class="flex items-center gap-2 rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-[12px] text-muted-color">
                      <span class="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
                      正在思考下一条追问，宿主区域仍可浏览和编辑。
                    </div>
                  </div>
                </div>

                <footer class="shrink-0 border-t border-surface-200 bg-surface-0 p-4">
                  <div class="rounded-md border border-surface-300 bg-surface-50 p-3">
                    <p class="min-h-[56px] text-[13px] leading-6 text-color">{journey.prompt}</p>
                    <div class="mt-3 flex items-center justify-between gap-3 border-t border-surface-200 pt-3 text-[12px] text-muted-color">
                      <span class="inline-flex items-center gap-2">
                        <i class="pi pi-at text-[12px]" />
                        引用 Thought / Category / Context
                      </span>
                      <span class="inline-flex items-center gap-2 rounded bg-primary-500 px-3 py-1.5 font-semibold text-white">
                        <i class="pi pi-send text-[11px]" />
                        Send
                      </span>
                    </div>
                  </div>
                </footer>
              </aside>
            )}
          </section>
        </main>
      );
    };
  },
});
