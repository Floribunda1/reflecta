import { FooterButton } from "@renderer/modules/shared/components/footer-button";
import { ContextDTO, SourceType } from "@shared/context";
import SelectButton from "primevue/selectbutton";
import { defineComponent, PropType, ref } from "vue";
import { SOURCE_META, SOURCE_PLACEHOLDER, SOURCE_TYPES } from "./types";
import InputText from "primevue/inputtext";
import { MarkdownEditor } from "@renderer/modules/shared/components/md-editor";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";

export const UpdateContextDrawer = defineComponent({
  props: {
    context: {
      type: Object as PropType<ContextDTO>,
    },
    handleConfirm: {
      type: Function as PropType<
        (
          form: Pick<ContextDTO, "sourceName" | "sourceType" | "content">,
        ) => unknown | Promise<unknown>
      >,
      required: true,
    },
  },
  setup(props) {
    const { closeDrawer } = useSharedDrawer();
    const sourceType = ref<SourceType | null>(null);
    const content = ref<string>("");
    const sourceName = ref<string | null>(null);

    if (props.context) {
      sourceType.value = props.context.sourceType;
      content.value = props.context.content;
      sourceName.value = props.context.sourceName;
    }

    return () => (
      <div class="flex flex-col gap-4 h-full">
        <div>
          <p class="mb-2 text-sm text-muted-color">来源类型</p>
          <SelectButton
            v-model={sourceType.value}
            options={SOURCE_TYPES.map((st) => ({
              value: st,
              label: SOURCE_META[st].label,
              icon: SOURCE_META[st].icon,
            }))}
            optionLabel="label"
            optionValue="value"
            size="small"
          >
            {{
              option: ({
                option,
              }: {
                option: { value: SourceType; label: string; icon: string };
              }) => (
                <span class="flex items-center gap-1">
                  <i class={`${option.icon} text-xs`} />
                  {option.label}
                </span>
              ),
            }}
          </SelectButton>
        </div>

        {sourceType.value !== "experience" && (
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-color">来源名称</label>
            <InputText
              value={sourceName.value}
              onInput={(e) => {
                sourceName.value = (e.target as HTMLInputElement).value;
              }}
              placeholder={SOURCE_PLACEHOLDER[sourceType.value!]}
              class="w-full"
            />
          </div>
        )}

        <div class="flex flex-col gap-1 flex-1 min-h-0">
          <p class="text-sm text-muted-color">内容</p>
          <div class="flex-1 min-h-0">
            <MarkdownEditor
              content={content.value}
              enableWikiLink={false}
              onUpdate={(v: string) => {
                content.value = v;
              }}
              height="100%"
            />
          </div>
        </div>

        <FooterButton
          cancelProps={{
            onClick: closeDrawer,
          }}
          okProps={{
            onClick: async () => {
              await props.handleConfirm({
                sourceType: sourceType.value!,
                sourceName: sourceName.value,
                content: content.value,
              });
              closeDrawer();
            },
            disabled: !content.value.trim() || !sourceType.value,
          }}
        />
      </div>
    );
  },
});
