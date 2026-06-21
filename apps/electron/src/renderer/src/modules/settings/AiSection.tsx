import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { ipcClient } from "@renderer/utils/ipc";

type AiConfig = Awaited<ReturnType<typeof ipcClient.config.getAiConfig>>;
type AiProviderConfig = AiConfig["providers"][number];
type AiModelConfig = AiProviderConfig["models"][number];
type AiProviderCatalogItem = Awaited<
  ReturnType<typeof ipcClient.config.listAiProviderCatalog>
>[number];

function createProvider(provider: AiProviderCatalogItem): AiProviderConfig {
  return {
    id: provider.id,
    apiKey: "",
    models: provider.models,
  };
}

function createModel(id = ""): AiModelConfig {
  return { id };
}

export function AiSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AiConfig>({ providers: [] });
  const [catalog, setCatalog] = useState<AiProviderCatalogItem[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([
      ipcClient.config.getAiConfig(),
      ipcClient.config.listAiProviderCatalog(),
    ]).then(([nextConfig, nextCatalog]) => {
      setConfig(nextConfig);
      setCatalog(nextCatalog);
      setSelectedProviderId((current) => current || nextCatalog[0]?.id || "");
    });
  }, []);

  const selectedProvider = catalog.find((provider) => provider.id === selectedProviderId);
  const providerConfig = config.providers.find((provider) => provider.id === selectedProviderId);
  const usesCodexAuth = selectedProvider?.authType === "codex";
  const models = providerConfig?.models.length
    ? providerConfig.models
    : (selectedProvider?.models ?? []);

  const upsertProvider = (providerId: string, patch: Partial<AiProviderConfig>) => {
    const provider = catalog.find((item) => item.id === providerId);
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

  const updateModel = (index: number, patch: Partial<AiModelConfig>) => {
    if (!selectedProvider) return;
    upsertProvider(selectedProvider.id, {
      models: models.map((model, modelIndex) =>
        modelIndex === index ? { ...model, ...patch } : model,
      ),
    });
  };

  const addModel = () => {
    if (!selectedProvider) return;
    upsertProvider(selectedProvider.id, { models: [...models, createModel()] });
  };

  const enableProvider = () => {
    if (!selectedProvider) return;
    upsertProvider(selectedProvider.id, {});
  };

  const removeModel = (index: number) => {
    if (!selectedProvider) return;
    upsertProvider(selectedProvider.id, {
      models: models.filter((_, modelIndex) => modelIndex !== index),
    });
  };

  const clearProvider = () => {
    setSaved(false);
    setConfig((current) => ({
      ...current,
      providers: current.providers.filter((provider) => provider.id !== selectedProviderId),
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

      <section className="grid min-h-0 flex-1 overflow-hidden border-t border-border/70 pt-5 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-0 border-r border-border/70 pr-3">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-2">
              {catalog.map((provider) => {
                const configured = config.providers.some(
                  (item) =>
                    item.id === provider.id && (provider.authType === "codex" || item.apiKey),
                );
                return (
                  <button
                    key={provider.id}
                    type="button"
                    className={[
                      "flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors",
                      selectedProviderId === provider.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    ].join(" ")}
                    onClick={() => setSelectedProviderId(provider.id)}
                  >
                    <span className="truncate">{provider.name}</span>
                    {configured ? <span className="size-1.5 rounded-full bg-emerald-500" /> : null}
                  </button>
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
                      ? providerConfig
                        ? "已启用 Codex CLI 会话"
                        : "未启用 Codex CLI 会话"
                      : providerConfig?.apiKey
                        ? "已配置 API Key"
                        : "未配置 API Key"}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={!providerConfig}
                  onClick={clearProvider}
                >
                  <Trash2 size={13} />
                  清除
                </Button>
              </div>

              <label className="flex shrink-0 flex-col gap-2">
                <span className="text-sm font-medium text-foreground">API Base URL</span>
                <Input
                  value={selectedProvider.baseUrl}
                  readOnly
                  className="font-mono text-muted-foreground"
                />
              </label>

              {usesCodexAuth ? (
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                  <span className="text-sm text-muted-foreground">使用本机 codex login 会话</span>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!!providerConfig}
                    onClick={enableProvider}
                  >
                    <Check size={13} />
                    启用
                  </Button>
                </div>
              ) : (
                <label className="flex shrink-0 flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">API Key</span>
                  <Input
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
                  <span className="text-sm font-medium text-foreground">Models</span>
                  <Button size="xs" variant="outline" onClick={addModel}>
                    <Plus size={13} />
                    Model
                  </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2 pr-3">
                    {models.map((model, modelIndex) => (
                      <div
                        key={`${selectedProvider.id}-${modelIndex}`}
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <Input
                          value={model.id}
                          onChange={(event) => updateModel(modelIndex, { id: event.target.value })}
                          placeholder="model-id"
                          className="font-mono"
                        />
                        <Input
                          value={model.name ?? ""}
                          onChange={(event) =>
                            updateModel(modelIndex, { name: event.target.value })
                          }
                          placeholder="显示名称"
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => removeModel(modelIndex)}
                          aria-label="删除模型"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <div className="flex shrink-0 items-center gap-3 border-t border-border/70 pt-5">
        <Button size="sm" disabled={loading} onClick={() => void handleSave()}>
          <Check size={15} />
          保存
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle size={14} className="text-emerald-600" />
            已保存
          </span>
        )}
      </div>
    </div>
  );
}
