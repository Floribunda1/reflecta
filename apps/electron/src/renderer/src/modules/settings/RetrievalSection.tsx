import { useEffect, useState } from "react";
import { Check, CheckCircle, Download } from "lucide-react";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Switch } from "@renderer/components/ui/switch";
import { ipcClient } from "@renderer/utils/ipc";

type RetrievalConfig = Awaited<ReturnType<typeof ipcClient.config.getRetrievalConfig>>;
type RetrievalEmbeddingModelStatus = Awaited<
  ReturnType<typeof ipcClient.config.getRetrievalEmbeddingModelStatus>
>;

export function RetrievalSection() {
  const [status, setStatus] = useState<RetrievalEmbeddingModelStatus | null>(null);
  const [config, setConfig] = useState<RetrievalConfig | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([
      ipcClient.config.getRetrievalEmbeddingModelStatus(),
      ipcClient.config.getRetrievalConfig(),
    ]).then(([nextStatus, nextConfig]) => {
      setStatus(nextStatus);
      setConfig(nextConfig);
    });
  }, []);

  const updateEmbedding = (patch: Partial<RetrievalConfig["embedding"]>) => {
    setSaved(false);
    setConfig((current) =>
      current
        ? {
            ...current,
            embedding: { ...current.embedding, ...patch },
          }
        : current,
    );
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      setStatus(await ipcClient.config.downloadDefaultRetrievalEmbeddingModel());
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      await ipcClient.config.setRetrievalConfig(config);
      const [nextStatus, nextConfig] = await Promise.all([
        ipcClient.config.getRetrievalEmbeddingModelStatus(),
        ipcClient.config.getRetrievalConfig(),
      ]);
      setStatus(nextStatus);
      setConfig(nextConfig);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const manifest = status?.manifest;
  const embedding = config?.embedding;
  const semanticEnabled = embedding?.provider === "openai-compatible";

  return (
    <div data-testid="settings-retrieval-section" className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-medium text-foreground">Retrieval</h3>
        <p className="mt-2 text-sm text-muted-foreground">用于 Agent 知识召回。</p>
      </div>

      {manifest && status && embedding ? (
        <>
          <section className="border-t border-border/70 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h4
                  data-testid="settings-retrieval-model-name"
                  className="truncate text-sm font-medium text-foreground"
                >
                  {manifest.name}
                </h4>
                <p
                  data-testid="settings-retrieval-model-purpose"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  本地语义检索 · {manifest.runtime} · {manifest.sizeLabel}
                </p>
              </div>
              <Badge
                data-testid="settings-retrieval-model-status"
                variant={status.downloaded ? "secondary" : "outline"}
              >
                {status.downloaded ? "已下载" : "未下载"}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={status.modelPath} readOnly className="font-mono text-xs" />
              <Button
                data-testid="settings-retrieval-download-button"
                type="button"
                size="sm"
                variant="outline"
                disabled={downloading}
                onClick={() => void handleDownload()}
              >
                <Download size={15} />
                {downloading ? "下载中" : "下载"}
              </Button>
            </div>
          </section>

          <section className="grid gap-4 border-t border-border/70 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-foreground">Semantic search</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  OpenAI-compatible embedding endpoint
                </p>
              </div>
              <Switch
                checked={semanticEnabled}
                onCheckedChange={(checked) =>
                  updateEmbedding({ provider: checked ? "openai-compatible" : "disabled" })
                }
                aria-label="启用本地语义检索"
              />
            </div>

            <Label className="flex flex-col items-start gap-2">
              <span>Endpoint</span>
              <Input
                value={embedding.baseUrl ?? ""}
                onChange={(event) => updateEmbedding({ baseUrl: event.target.value })}
                placeholder="http://127.0.0.1:8080/v1"
                className="font-mono"
              />
            </Label>

            <Label className="flex flex-col items-start gap-2">
              <span>Model</span>
              <Input
                value={embedding.modelId}
                onChange={(event) => updateEmbedding({ modelId: event.target.value })}
                className="font-mono"
              />
            </Label>
          </section>

          <div className="flex items-center gap-3 border-t border-border/70 pt-5">
            <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
              <Check size={15} />
              保存
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle size={14} className="text-emerald-600" />
                已保存
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
