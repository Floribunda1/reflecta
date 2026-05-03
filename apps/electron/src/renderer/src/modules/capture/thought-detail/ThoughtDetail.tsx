import { defineComponent, ref, computed, watch, toRef, PropType } from "vue";
import { Teleport } from "vue";
import { MarkdownEditor } from "@renderer/modules/shared/components/md-editor";
import { createThoughtDetailContext } from "./context";
import { ContextList } from "./context/ContextList";
import { ConnectionList } from "./connection/ConnectionList";
import { ThoughtTypeBadge } from "./ThoughtTypeBadge";
import Button from "primevue/button";
import Menu from "primevue/menu";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";
import { cloneDeep, debounce } from "lodash-es";
import InputText from "primevue/inputtext";
import { ipcClient } from "@renderer/utils/ipc";
import { useConfirm } from "primevue/useconfirm";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";

export const ThoughtDetail = defineComponent({
  name: "ThoughtDetail",
  emits: ["close"],
  props: {
    thoughtId: {
      type: String as PropType<string>,
      required: true,
    },
    presentation: {
      type: String as PropType<"workspace" | "panel">,
      default: "workspace",
    },
    onDeleted: {
      type: Function as PropType<() => void>,
      required: false,
    },
  },
  setup(props, { emit }) {
    const focusMode = ref(false);
    const thoughtId = toRef(props, "thoughtId");
    const { thought, updateThought } = createThoughtDetailContext(thoughtId);
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const router = useRouter();
    const deleting = ref(false);

    const toggleFocusMode = () => {
      focusMode.value = !focusMode.value;
    };

    const body = ref(thought.value?.body ?? "");
    const title = ref(thought.value?.title ?? "");
    const categoryIds = computed(() => thought.value?.categoryIds);
    const activeTab = ref("context");

    // Reset when thought changes
    watch(
      () => thought.value?.body,
      () => {
        body.value = thought.value?.body ?? "";
      },
    );

    watch(
      () => thought.value?.title,
      () => {
        title.value = thought.value?.title ?? "";
      },
    );

    const debouncedUpdate = debounce((v: string) => {
      updateThought({
        body: v,
        categoryIds: categoryIds.value,
      });
    });

    const debouncedTitleUpdate = debounce((v: string) => {
      updateThought({
        title: v || null,
      });
    });

    const generatingSummary = ref(false);
    const actionMenuRef = ref();

    const handleGenerateSummary = async () => {
      const content = thought.value?.body;
      if (!content?.trim()) return;
      generatingSummary.value = true;
      try {
        const summary = await ipcClient.ai.generateSummary(
          content,
          cloneDeep(thought.value?.contexts ?? []),
        );
        title.value = summary;
        await updateThought({ title: summary });
      } catch (e: any) {
        console.error("生成摘要失败", e);
      } finally {
        generatingSummary.value = false;
      }
    };

    const connectionCount = computed(
      () => (thought.value?.connections.length ?? 0) + (thought.value?.referencedBy.length ?? 0),
    );

    const convertingType = ref(false);
    const typeMenuRef = ref();
    const typeMenuItems = computed(() => [
      {
        label: "Idea",
        icon: "pi pi-lightbulb",
        command: async () => {
          if (!thought.value || thought.value.type === "idea") return;
          convertingType.value = true;
          try {
            await updateThought({ type: "idea" });
          } finally {
            convertingType.value = false;
          }
        },
      },
      {
        label: "Insight",
        icon: "pi pi-star",
        command: async () => {
          if (!thought.value || thought.value.type === "insight") return;
          convertingType.value = true;
          try {
            await updateThought({ type: "insight" });
          } finally {
            convertingType.value = false;
          }
        },
      },
    ]);

    const handleBadgeClick = (e: MouseEvent) => {
      typeMenuRef.value?.toggle(e);
    };

    const actionMenuItems = computed(() => [
      {
        label: "删除 Thought",
        icon: "pi pi-trash",
        command: handleDelete,
      },
    ]);

    const actionGroupClass =
      "flex items-center rounded-md border border-[var(--p-content-border-color)] bg-transparent p-0.5";
    const actionButtonClass = "!h-8 !w-8";
    const tabCountClass = (value: "context" | "connections") => [
      "rounded px-1.5 text-xs font-semibold leading-5 tabular-nums",
      activeTab.value === value ? "bg-surface-100 text-muted-color" : "text-muted-color",
    ];

    const renderHeaderActions = () => (
      <div class="flex shrink-0 items-center gap-2">
        <div class={actionGroupClass}>
          <Button
            icon="pi pi-sparkles"
            text
            rounded
            severity="secondary"
            aria-label="AI 生成摘要标题"
            title="AI 生成摘要标题"
            loading={generatingSummary.value}
            disabled={!thought.value?.body?.trim()}
            class={actionButtonClass}
            onClick={handleGenerateSummary}
          />
        </div>

        <div class={actionGroupClass}>
          <Menu ref={actionMenuRef} model={actionMenuItems.value} popup />
          <Button
            icon="pi pi-ellipsis-h"
            text
            rounded
            severity="secondary"
            aria-label="更多操作"
            title="更多操作"
            class={actionButtonClass}
            loading={deleting.value}
            onClick={(e: MouseEvent) => actionMenuRef.value?.toggle(e)}
          />
        </div>

        <div class={actionGroupClass}>
          <Button
            icon={focusMode.value ? "pi pi-window-minimize" : "pi pi-window-maximize"}
            text
            rounded
            severity="secondary"
            aria-label={focusMode.value ? "退出专注模式" : "专注模式"}
            title={focusMode.value ? "退出专注模式" : "专注模式"}
            class={actionButtonClass}
            onClick={() => toggleFocusMode()}
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            aria-label="关闭详情"
            title="关闭详情"
            class={actionButtonClass}
            onClick={() => emit("close")}
          />
        </div>
      </div>
    );

    const handleCategoryUpdate = async (categoryIds: string[]) => {
      await updateThought({
        body: thought.value!.body,
        categoryIds,
      });
    };

    const handleDelete = async () => {
      if (!thought.value) return;
      confirm.require({
        message: `确定要删除这条 Thought 吗？此操作不可撤销。`,
        header: "删除 Thought",
        rejectLabel: "取消",
        acceptLabel: "删除",
        acceptClass: "p-button-danger",
        accept: async () => {
          deleting.value = true;
          try {
            await ipcClient.thought.deleteThought(thoughtId.value);
            await queryClient.invalidateQueries({
              queryKey: ["thought.listThoughts"],
              exact: false,
            });
            props.onDeleted?.();
          } finally {
            deleting.value = false;
          }
        },
      });
    };

    const renderBodySection = (panel = false) => (
      <div class="flex h-full min-w-0 flex-col bg-surface-0">
        <div class={["shrink-0", panel ? "px-6 pt-5" : "px-8 pt-6"]}>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <Menu ref={typeMenuRef} model={typeMenuItems.value} popup />
              <InputText
                value={title.value}
                onInput={(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  title.value = v;
                  debouncedTitleUpdate(v);
                }}
                placeholder="无标题"
                class="w-full"
                pt={{
                  root: {
                    class: `border-none bg-transparent px-0 ${panel ? "text-2xl" : "text-3xl"} font-semibold leading-[1.08] text-color shadow-none placeholder:text-muted-color`,
                  },
                }}
              />
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <div
                  class="inline-flex cursor-pointer rounded-md"
                  title="更改类型"
                  onClick={handleBadgeClick}
                >
                  <ThoughtTypeBadge type={thought.value!.type} />
                </div>
                <CategoryTreeSelect
                  modelValue={thought.value!.categoryIds}
                  onUpdate:modelValue={handleCategoryUpdate}
                  placeholder="+ 添加分类"
                  fluid={false}
                  usePathLabel={false}
                  variant="inline"
                  class="max-w-full"
                />
              </div>
            </div>

            {renderHeaderActions()}
          </div>
        </div>

        <div class={["min-h-0 flex-1", panel ? "px-6 pb-6 pt-4" : "px-8 pb-8 pt-5"]}>
          <MarkdownEditor
            content={body.value}
            onUpdate={(v: string) => {
              body.value = v;
              debouncedUpdate(v);
            }}
            height="100%"
          />
        </div>
      </div>
    );

    const renderContextAside = (panel = false) => (
      <aside class="flex h-full min-w-0 flex-col bg-surface-0">
        <Tabs
          value={activeTab.value}
          {...{
            "onUpdate:value": (v: string) => {
              activeTab.value = v;
            },
          }}
          class="flex min-h-0 flex-1 flex-col"
        >
          <TabList
            class={[
              panel ? "mx-5 mt-4" : "mx-5 mt-5",
              "flex shrink-0 gap-1 border-b border-[var(--p-content-border-color)] pb-2",
            ]}
          >
            <Tab value="context">
              <span class="flex items-center gap-1.5 text-xs font-semibold">
                Context
                <span class={tabCountClass("context")}>{thought.value!.contexts.length}</span>
              </span>
            </Tab>
            <Tab value="connections">
              <span class="flex items-center gap-1.5 text-xs font-semibold">
                Connections
                <span class={tabCountClass("connections")}>{connectionCount.value}</span>
              </span>
            </Tab>
          </TabList>
          <TabPanels class="min-h-0 flex-1 overflow-y-auto px-5 py-4 capture-scroll">
            <TabPanel value="context">
              <ContextList />
            </TabPanel>
            <TabPanel value="connections">
              <ConnectionList
                onViewGraph={() =>
                  router.push({
                    name: "Contemplate",
                    query: { selectThoughtId: thought.value!.id },
                  })
                }
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </aside>
    );

    const renderPanelWorkspace = () => (
      <Splitter
        layout="vertical"
        class="h-full w-full rounded-none! border-none! bg-surface-0"
        gutterSize={1}
      >
        <SplitterPanel size={62} minSize={42}>
          {renderBodySection(true)}
        </SplitterPanel>
        <SplitterPanel size={38} minSize={22}>
          {renderContextAside(true)}
        </SplitterPanel>
      </Splitter>
    );

    const renderWorkspace = () => (
      <Splitter
        layout="horizontal"
        class="h-full w-full rounded-none! border-none! bg-surface-0"
        gutterSize={1}
      >
        <SplitterPanel size={72} minSize={52}>
          {renderBodySection()}
        </SplitterPanel>
        <SplitterPanel size={28} minSize={22}>
          <div class="h-full min-w-[320px] border-l border-surface-200/70">
            {renderContextAside()}
          </div>
        </SplitterPanel>
      </Splitter>
    );

    return () => {
      if (!thought.value) return null;

      if (focusMode.value) {
        return (
          <Teleport to="body">
            <div class="fixed left-0 top-0 z-100 h-screen w-screen bg-surface-0">
              {renderWorkspace()}
            </div>
          </Teleport>
        );
      }

      if (props.presentation === "panel") {
        return <div class="h-full w-full bg-surface-0">{renderPanelWorkspace()}</div>;
      }

      return <div class="h-full w-full bg-surface-0">{renderWorkspace()}</div>;
    };
  },
});
