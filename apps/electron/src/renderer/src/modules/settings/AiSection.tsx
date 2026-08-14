import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle, ExternalLink, LoaderCircle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@reflecta/ui/components/button";
import { Checkbox } from "@reflecta/ui/components/checkbox";
import { Input } from "@reflecta/ui/components/input";
import { Item, ItemActions, ItemContent } from "@reflecta/ui/components/item";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reflecta/ui/components/input-group";
import { NativeSelect, NativeSelectOption } from "@reflecta/ui/components/native-select";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { ipcClient } from "@renderer/utils/ipc";

type AiConfig = Awaited<ReturnType<typeof ipcClient.config.getAiConfig>>;
type AiProviderConfig = AiConfig["providers"][number];
type AiModelSelection = NonNullable<AiConfig["activeAgentModel"]>;
type AiProviderDefinition = Awaited<
  ReturnType<typeof ipcClient.config.listAiProviderDefinitions>
>[number];

function createProvider(provider: AiProviderDefinition): AiProviderConfig {
  return {
    id: provider.id,
    apiKey: "",
    enabledModelIds: [],
  };
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

function modelSelectionValue(selection: AiModelSelection | undefined): string {
  if (!selection) return "";
  return `${encodeURIComponent(selection.providerId)}:${encodeURIComponent(selection.modelId)}`;
}

function parseModelSelectionValue(value: string): AiModelSelection | undefined {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) return undefined;
  return {
    providerId: decodeURIComponent(value.slice(0, separatorIndex)),
    modelId: decodeURIComponent(value.slice(separatorIndex + 1)),
  };
}

export function AiSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AiConfig>({ providers: [] });
  const [providers, setProviders] = useState<AiProviderDefinition[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [codexConnected, setCodexConnected] = useState(false);
  const [codexBusy, setCodexBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([
      ipcClient.config.getAiConfig(),
      ipcClient.config.listAiProviderDefinitions(),
      ipcClient.config.getCodexAuthStatus(),
    ]).then(([nextConfig, nextProviders, nextCodexConnected]) => {
      setConfig(nextConfig);
      setProviders(nextProviders);
      setCodexConnected(nextCodexConnected);
      setSelectedProviderId((current) => current || nextProviders[0]?.id || "");
    });
  }, []);

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const providerConfig = config.providers.find((provider) => provider.id === selectedProviderId);
  const usesCodexAuth = selectedProvider?.authType === "codex";
  const providerAvailable = usesCodexAuth ? codexConnected : !!providerConfig?.apiKey.trim();
  const enabledModelIds = providerConfig?.enabledModelIds ?? [];
  const enabledModelIdSet = new Set(enabledModelIds);
  const normalizedQuery = modelQuery.trim().toLocaleLowerCase();
  const models = (selectedProvider?.models ?? [])
    .filter(
      (model) =>
        !normalizedQuery ||
        model.name.toLocaleLowerCase().includes(normalizedQuery) ||
        model.id.toLocaleLowerCase().includes(normalizedQuery),
    )
    .toSorted((left, right) => {
      const enabledOrder =
        Number(enabledModelIdSet.has(right.id)) - Number(enabledModelIdSet.has(left.id));
      return enabledOrder || left.name.localeCompare(right.name);
    });
  const titleModelOptions = config.providers.flatMap((provider) => {
    const definition = providers.find((item) => item.id === provider.id);
    if (
      !definition ||
      (definition.authType === "codex" ? !codexConnected : !provider.apiKey.trim())
    )
      return [];
    const modelsById = new Map(definition.models.map((model) => [model.id, model]));
    return provider.enabledModelIds.flatMap((modelId) => {
      const model = modelsById.get(modelId);
      if (!model) return [];
      return [
        {
          providerId: provider.id,
          modelId: model.id,
          label: `${definition.name} / ${model.name}`,
        },
      ];
    });
  });
  const titleModelValue = modelSelectionValue(config.titleGenerationModel);
  const selectedTitleModelValue = titleModelOptions.some(
    (option) => modelSelectionValue(option) === titleModelValue,
  )
    ? titleModelValue
    : "";

  const upsertProvider = (providerId: string, patch: Partial<AiProviderConfig>) => {
    const provider = providers.find((item) => item.id === providerId);
    if (!provider) return;
    setSaved(false);
    setConfig((current) => {
      const existing = current.providers.find((item) => item.id === providerId);
      const nextProvider = { ...(existing ?? createProvider(provider)), ...patch };
      return {
        ...current,
        providers: existing
          ? current.providers.map((item) => (item.id === providerId ? nextProvider : item))
          : [...current.providers, nextProvider],
      };
    });
  };

  const toggleModel = (modelId: string, enabled: boolean) => {
    if (!selectedProvider) return;
    upsertProvider(selectedProvider.id, {
      enabledModelIds: enabled
        ? [...enabledModelIds, modelId]
        : enabledModelIds.filter((id) => id !== modelId),
    });
  };

  const clearProvider = () => {
    setSaved(false);
    setConfig((current) => ({
      ...current,
      providers: current.providers.filter((provider) => provider.id !== selectedProviderId),
      titleGenerationModel:
        current.titleGenerationModel?.providerId === selectedProviderId
          ? undefined
          : current.titleGenerationModel,
    }));
  };

  const handleConnectCodex = async () => {
    if (!selectedProvider) return;
    setCodexBusy(true);
    try {
      const connected = await ipcClient.config.connectCodex();
      if (!connected) throw new Error("OpenAI 授权未完成");
      setCodexConnected(true);
      upsertProvider(selectedProvider.id, {});
      toast.success("已连接 ChatGPT 订阅");
    } catch (error) {
      toast.error("连接 Codex 失败", { description: errorMessage(error) });
    } finally {
      setCodexBusy(false);
    }
  };

  const handleDisconnectCodex = async () => {
    setCodexBusy(true);
    try {
      await ipcClient.config.disconnectCodex();
      setCodexConnected(false);
      clearProvider();
      await queryClient.invalidateQueries({ queryKey: ["ai.model-options"] });
      toast.success("已断开 ChatGPT 订阅");
    } catch (error) {
      toast.error("断开 Codex 失败", { description: errorMessage(error) });
    } finally {
      setCodexBusy(false);
    }
  };

  const selectTitleGenerationModel = (value: string) => {
    setSaved(false);
    setConfig((current) => ({
      ...current,
      titleGenerationModel: parseModelSelectionValue(value),
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await ipcClient.config.setAiConfig(config);
      setConfig(await ipcClient.config.getAiConfig());
      await queryClient.invalidateQueries({ queryKey: ["ai.model-options"] });
      setSaved(true);
    } catch (error) {
      toast.error("保存 AI 配置失败", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="shrink-0">
        <h3 className="text-base font-medium text-foreground">AI</h3>
        <p className="mt-2 text-sm text-muted-foreground">用于摘要标题生成和 Agent 对话。</p>
      </div>

      <section className="flex shrink-0 flex-col gap-3 section-divider sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-foreground">标题生成模型</span>
        <NativeSelect
          data-testid="settings-ai-title-model"
          className="w-full sm:w-90"
          value={selectedTitleModelValue}
          disabled={titleModelOptions.length === 0}
          onChange={(event) => selectTitleGenerationModel(event.target.value)}
        >
          {titleModelOptions.length === 0 ? (
            <NativeSelectOption value="">请先配置可用模型</NativeSelectOption>
          ) : null}
          {titleModelOptions.map((option) => (
            <NativeSelectOption
              key={modelSelectionValue(option)}
              value={modelSelectionValue(option)}
            >
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </section>

      <section className="grid min-h-0 flex-1 overflow-hidden section-divider sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-0 border-r border-border pr-3">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-2">
              {providers.map((provider) => {
                const configured = config.providers.some(
                  (item) =>
                    item.id === provider.id &&
                    (provider.authType === "codex" ? codexConnected : !!item.apiKey),
                );
                return (
                  <Button
                    key={provider.id}
                    data-testid="settings-ai-provider"
                    data-provider-id={provider.id}
                    type="button"
                    variant={selectedProviderId === provider.id ? "secondary" : "ghost"}
                    size="default"
                    className={`w-full justify-between px-3 ${selectedProviderId === provider.id ? "" : "text-muted-foreground"}`}
                    onClick={() => setSelectedProviderId(provider.id)}
                  >
                    <span className="truncate">{provider.name}</span>
                    {configured ? <span className="size-1.5 rounded-full bg-success" /> : null}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-5 pl-5">
          {selectedProvider ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-foreground">
                    {selectedProvider.name}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {usesCodexAuth
                      ? codexConnected
                        ? "已连接 ChatGPT 订阅"
                        : "未连接 ChatGPT 订阅"
                      : providerConfig?.apiKey
                        ? "已配置 API Key"
                        : "未配置 API Key"}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={usesCodexAuth ? !codexConnected || codexBusy : !providerConfig}
                  onClick={() => (usesCodexAuth ? void handleDisconnectCodex() : clearProvider())}
                >
                  <Trash2 size={13} />
                  {usesCodexAuth ? "断开" : "清除"}
                </Button>
              </div>

              {usesCodexAuth ? (
                <Item variant="outline" size="xs" className="shrink-0 justify-between">
                  <ItemContent>
                    <span className="text-sm text-muted-foreground">
                      {codexConnected
                        ? "已通过 OpenAI 授权，凭据会自动刷新"
                        : "通过浏览器登录 ChatGPT Plus/Pro，完成后自动返回 Reflecta"}
                    </span>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={codexBusy}
                      onClick={() => void handleConnectCodex()}
                    >
                      {codexBusy ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : (
                        <ExternalLink size={13} />
                      )}
                      {codexBusy ? "等待授权" : codexConnected ? "重新连接" : "连接"}
                    </Button>
                  </ItemActions>
                </Item>
              ) : (
                <label className="flex shrink-0 flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">API Key</span>
                  <Input
                    data-testid="settings-ai-api-key-input"
                    value={providerConfig?.apiKey ?? ""}
                    onChange={(event) =>
                      upsertProvider(selectedProvider.id, { apiKey: event.target.value })
                    }
                    type="password"
                    placeholder="sk-..."
                    className="font-mono"
                  />
                </label>
              )}

              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">用于 Chat 的模型</span>
                  <span className="text-xs text-muted-foreground">
                    已选择 {enabledModelIds.length} 个
                  </span>
                </div>
                <InputGroup className="shrink-0">
                  <InputGroupAddon align="inline-start">
                    <Search className="size-4 text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    data-testid="settings-ai-model-search"
                    value={modelQuery}
                    onChange={(event) => setModelQuery(event.target.value)}
                    placeholder="搜索模型名称或 ID"
                    disabled={!providerAvailable}
                  />
                </InputGroup>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-1 pr-3">
                    {models.map((model) => (
                      <label
                        key={model.id}
                        data-testid="settings-ai-model-option"
                        data-model-id={model.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted"
                      >
                        <Checkbox
                          checked={enabledModelIdSet.has(model.id)}
                          disabled={!providerAvailable}
                          onCheckedChange={(checked) => toggleModel(model.id, checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {model.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {model.id}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {model.supportedReasoningLevels.length === 1
                            ? "无推理"
                            : model.supportedReasoningLevels.join(" / ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <div className="flex shrink-0 items-center gap-3 section-divider">
        <Button
          data-testid="settings-ai-save-button"
          size="sm"
          disabled={loading || codexBusy}
          onClick={() => void handleSave()}
        >
          <Check size={15} />
          保存
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle size={14} className="text-success" />
            已保存
          </span>
        )}
      </div>
    </div>
  );
}
