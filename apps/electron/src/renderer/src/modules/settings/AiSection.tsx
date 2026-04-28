import { defineComponent, ref, onMounted } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { ipcClient } from "@renderer/utils/ipc";

export const AiSection = defineComponent({
  name: "AiSection",
  setup() {
    const apiKey = ref("");
    const baseUrl = ref("");
    const model = ref("");
    const loading = ref(false);
    const saved = ref(false);

    onMounted(async () => {
      const config = await ipcClient.config.getAiConfig();
      apiKey.value = config.apiKey;
      baseUrl.value = config.baseUrl;
      model.value = config.model;
    });

    const handleSave = async () => {
      loading.value = true;
      saved.value = false;
      try {
        await ipcClient.config.setAiConfig({
          apiKey: apiKey.value,
          baseUrl: baseUrl.value,
          model: model.value,
        });
        saved.value = true;
      } finally {
        loading.value = false;
      }
    };

    return () => (
      <div class="mx-auto flex max-w-2xl flex-col gap-6">
        <div class="border-b border-surface-100 pb-4">
          <h3 class="text-lg font-semibold leading-none text-color">AI</h3>
          <p class="mt-2 text-sm text-muted-color">用于摘要标题生成等辅助能力。</p>
        </div>

        <div class="flex flex-col gap-4">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-color">API Key</span>
            <InputText
              v-model={apiKey.value}
              type="password"
              size="small"
              placeholder="sk-..."
              class="w-full font-mono"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-color">Base URL</span>
            <InputText
              v-model={baseUrl.value}
              size="small"
              placeholder="https://api.openai.com/v1"
              class="w-full font-mono"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-color">Model</span>
            <InputText
              v-model={model.value}
              size="small"
              placeholder="gpt-4o"
              class="w-full font-mono"
            />
          </label>
        </div>

        <div class="flex items-center gap-3">
          <Button
            size="small"
            label="保存"
            icon="pi pi-check"
            loading={loading.value}
            onClick={handleSave}
          />
          {saved.value && (
            <span class="inline-flex items-center gap-1 text-xs text-emerald-600">
              <i class="pi pi-check-circle" />
              已保存
            </span>
          )}
        </div>
      </div>
    );
  },
});
