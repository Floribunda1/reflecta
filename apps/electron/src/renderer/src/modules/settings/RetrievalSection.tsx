import { useEffect, useState } from "react";
import { Check, CheckCircle, Download } from "lucide-react";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Progress } from "@renderer/components/ui/progress";
import { Switch } from "@renderer/components/ui/switch";
import { ipcClient } from "@renderer/utils/ipc";

type RetrievalConfig = Awaited<ReturnType<typeof ipcClient.config.getRetrievalConfig>>;
type RetrievalEmbeddingModelStatus = Awaited<
  ReturnType<typeof ipcClient.config.getRetrievalEmbeddingModelStatus>
>;
type RetrievalIndexStatus = Awaited<ReturnType<typeof ipcClient.config.getRetrievalIndexStatus>>;

function indexStatusLabel(state: RetrievalIndexStatus["state"]) {
  if (state === "ready") return "已完成";
  if (state === "indexing") return "索引中";
  if (state === "dirty") return "需要重建";
  if (state === "error") return "构建失败";
  return "未建立";
}

function downloadStatusLabel(status: RetrievalEmbeddingModelStatus) {
  const { download } = status;
  if (download.state === "downloading") {
    return download.percent === undefined ? "下载中" : `下载中 ${download.percent}%`;
  }
  if (download.state === "error") return "下载失败";
  return status.downloaded ? "已下载" : "未下载";
}

export function RetrievalSection() {
  const [status, setStatus] = useState<RetrievalEmbeddingModelStatus | null>(null);
  const [indexStatus, setIndexStatus] = useState<RetrievalIndexStatus | null>(null);
  const [config, setConfig] = useState<RetrievalConfig | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([
      ipcClient.config.getRetrievalEmbeddingModelStatus(),
      ipcClient.config.getRetrievalConfig(),
      ipcClient.config.getRetrievalIndexStatus(),
    ]).then(([nextStatus, nextConfig, nextIndexStatus]) => {
      setStatus(nextStatus);
      setConfig(nextConfig);
      setIndexStatus(nextIndexStatus);
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
    const interval = window.setInterval(() => {
      void ipcClient.config.getRetrievalEmbeddingModelStatus().then(setStatus);
    }, 250);
    try {
      setStatus(await ipcClient.config.downloadDefaultRetrievalEmbeddingModel());
    } catch {
      setStatus(await ipcClient.config.getRetrievalEmbeddingModelStatus());
    } finally {
      window.clearInterval(interval);
      setDownloading(false);
    }
  };

  const handleRebuildIndex = async () => {
    setIndexing(true);
    const interval = window.setInterval(() => {
      void ipcClient.config.getRetrievalIndexStatus().then(setIndexStatus);
    }, 250);
    try {
      setIndexStatus(await ipcClient.config.rebuildRetrievalIndex());
    } catch {
      setIndexStatus(await ipcClient.config.getRetrievalIndexStatus());
    } finally {
      window.clearInterval(interval);
      setIndexing(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      await ipcClient.config.setRetrievalConfig(config);
      const [nextStatus, nextConfig, nextIndexStatus] = await Promise.all([
        ipcClient.config.getRetrievalEmbeddingModelStatus(),
        ipcClient.config.getRetrievalConfig(),
        ipcClient.config.getRetrievalIndexStatus(),
      ]);
      setStatus(nextStatus);
      setConfig(nextConfig);
      setIndexStatus(nextIndexStatus);
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
                {downloadStatusLabel(status)}
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
            {status.download.state === "downloading" ? (
              <Progress
                data-testid="settings-retrieval-download-progress"
                value={status.download.percent ?? 0}
                className="mt-3"
              />
            ) : null}
            {status.download.state === "error" && status.download.error ? (
              <p className="mt-2 text-xs text-destructive">{status.download.error}</p>
            ) : null}
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

          {indexStatus ? (
            <section className="border-t border-border/70 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground">Indexing</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {indexStatus.embeddingModel} · projection v{indexStatus.projectionVersion}
                  </p>
                </div>
                <Badge
                  data-testid="settings-retrieval-index-status"
                  variant={indexStatus.state === "ready" ? "secondary" : "outline"}
                >
                  {indexStatusLabel(indexStatus.state)}
                </Badge>
              </div>
              {indexStatus.state === "indexing" ? (
                <Progress
                  data-testid="settings-retrieval-index-progress"
                  value={null}
                  className="mt-3"
                />
              ) : null}
              {indexStatus.state === "error" && indexStatus.error ? (
                <p className="mt-2 text-xs text-destructive">{indexStatus.error}</p>
              ) : null}
              <Button
                data-testid="settings-retrieval-rebuild-button"
                type="button"
                size="sm"
                variant="outline"
                className="mt-4"
                disabled={indexing}
                onClick={() => void handleRebuildIndex()}
              >
                {indexing ? "重建中" : "重新构建检索索引"}
              </Button>
            </section>
          ) : null}

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
