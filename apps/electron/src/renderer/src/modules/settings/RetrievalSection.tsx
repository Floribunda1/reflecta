import { useEffect, useState } from "react";
import { runPromise } from "@renderer/lib/effect-runtime";
import { Download, RefreshCw } from "lucide-react";
import { Badge } from "@reflecta/ui/components/badge";
import { Button } from "@reflecta/ui/components/button";
import { Progress } from "@reflecta/ui/components/progress";
import { Switch } from "@reflecta/ui/components/switch";
import { rpc } from "@renderer/lib/effect-rpc";

type RetrievalConfig = import("../../../../ipc").RetrievalConfig;
type RetrievalEmbeddingModelStatus = Awaited<
  import("../../../../ipc").RetrievalEmbeddingModelStatus
>;
type RetrievalIndexStatus = import("../../../../ipc").RetrievalIndexStatus;

function indexStatusLabel(state: RetrievalIndexStatus["state"]) {
  if (state === "ready") return "已就绪";
  if (state === "indexing") return "构建中";
  if (state === "error") return "构建失败";
  return "未建立";
}

function modelStatusLabel(status: RetrievalEmbeddingModelStatus) {
  if (status.download.state === "downloading") return "下载中";
  if (status.download.state === "error") return "下载失败";
  return status.downloaded ? "已安装" : "未安装";
}

function indexDescription(indexStatus: RetrievalIndexStatus) {
  if (indexStatus.state === "ready") {
    return `使用 ${indexStatus.embeddingModel} · projection v${indexStatus.projectionVersion}`;
  }
  if (indexStatus.state === "indexing") {
    return `${indexStatus.embeddingModel} · projection v${indexStatus.projectionVersion}`;
  }
  if (indexStatus.state === "error") return "上一次构建没有完成。";
  return "构建后 Agent 才能使用语义检索结果。";
}

function indexProgressLabel(progress: NonNullable<RetrievalIndexStatus["progress"]>) {
  const phase =
    progress.phase === "preparing"
      ? "准备文档"
      : progress.phase === "embedding"
        ? "生成 embedding"
        : "写入索引";
  return progress.total > 0 ? `${phase} ${progress.completed}/${progress.total}` : phase;
}

export function RetrievalSection() {
  const [status, setStatus] = useState<RetrievalEmbeddingModelStatus | null>(null);
  const [indexStatus, setIndexStatus] = useState<RetrievalIndexStatus | null>(null);
  const [config, setConfig] = useState<RetrievalConfig | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      runPromise(rpc.configGetEmbeddingStatus()),
      runPromise(rpc.configGetRetrieval()),
      runPromise(rpc.configGetIndexStatus()),
    ]).then(([nextStatus, nextConfig, nextIndexStatus]) => {
      setStatus(nextStatus);
      setConfig(nextConfig);
      setIndexStatus(nextIndexStatus);
    });
  }, []);

  const saveEmbedding = async (patch: Partial<RetrievalConfig["embedding"]>) => {
    if (!config) return;
    const nextConfig = {
      ...config,
      embedding: { ...config.embedding, ...patch },
    };
    setSaving(true);
    setConfig(nextConfig);
    try {
      await runPromise(
        rpc.configSetRetrieval(nextConfig as import("../../../../ipc").RetrievalConfig),
      );
      const [nextStatus, savedConfig, nextIndexStatus] = await Promise.all([
        runPromise(rpc.configGetEmbeddingStatus()),
        runPromise(rpc.configGetRetrieval()),
        runPromise(rpc.configGetIndexStatus()),
      ]);
      setStatus(nextStatus);
      setConfig(savedConfig);
      setIndexStatus(nextIndexStatus);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const interval = window.setInterval(() => {
        void runPromise(rpc.configGetEmbeddingStatus()).then(setStatus);
      }, 250);
      try {
        setStatus(await runPromise(rpc.configDownloadModel()));
      } catch {
        setStatus(await runPromise(rpc.configGetEmbeddingStatus()));
      } finally {
        window.clearInterval(interval);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleRebuildIndex = async () => {
    setIndexing(true);
    try {
      const interval = window.setInterval(() => {
        void runPromise(rpc.configGetIndexStatus()).then(setIndexStatus);
      }, 250);
      try {
        setIndexStatus(await runPromise(rpc.configRebuildIndex()));
      } catch {
        setIndexStatus(await runPromise(rpc.configGetIndexStatus()));
      } finally {
        window.clearInterval(interval);
      }
    } finally {
      setIndexing(false);
    }
  };

  const manifest = status?.manifest;
  const embedding = config?.embedding;
  const semanticEnabled = embedding ? embedding.provider !== "disabled" : false;
  const canRebuildIndex = !indexing && (!semanticEnabled || status?.downloaded);

  return (
    <div data-testid="settings-retrieval-section" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Agent 语义检索</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            仅影响 Agent 知识检索；@ 输入提示仍使用关键词匹配。
          </p>
        </div>
        {manifest && status && embedding ? (
          <div className="flex items-center gap-3">
            {saving ? <span className="text-xs text-muted-foreground">保存中</span> : null}
            <Switch
              checked={semanticEnabled}
              disabled={saving}
              onCheckedChange={(checked) =>
                void saveEmbedding({
                  provider: checked ? "local-llama-cpp" : "disabled",
                  modelId: checked ? manifest.modelId : embedding.modelId,
                  modelPath: checked ? status.modelPath : embedding.modelPath,
                  baseUrl: undefined,
                  apiKey: undefined,
                })
              }
              aria-label="启用 Agent 语义检索"
            />
          </div>
        ) : null}
      </div>

      {manifest && status && embedding ? (
        <>
          <section className="section-divider">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-3 text-xs font-medium text-foreground">本地模型</p>
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
                  本地 embedding 模型 · {manifest.runtime} · {manifest.sizeLabel}
                </p>
              </div>
              <Badge
                data-testid="settings-retrieval-model-status"
                variant={status.downloaded ? "secondary" : "outline"}
              >
                {modelStatusLabel(status)}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!status.downloaded || status.download.state === "error" ? (
                <Button
                  data-testid="settings-retrieval-download-button"
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                >
                  {status.download.state === "error" ? (
                    <RefreshCw size={15} />
                  ) : (
                    <Download size={15} />
                  )}
                  {downloading
                    ? "下载中"
                    : status.download.state === "error"
                      ? "重新下载"
                      : "下载模型"}
                </Button>
              ) : null}
              {status.downloaded ? (
                <span className="text-xs text-muted-foreground">模型已保存在本机。</span>
              ) : null}
            </div>
            {status.modelPath ? (
              <p className="mt-3 truncate font-mono text-xs text-muted-foreground">
                {status.modelPath}
              </p>
            ) : null}
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

          {indexStatus ? (
            <section className="section-divider">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-3 text-xs font-medium text-foreground">检索索引</p>
                  <h4 className="text-sm font-medium text-foreground">
                    {semanticEnabled && !status.downloaded
                      ? "等待模型"
                      : indexStatusLabel(indexStatus.state)}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {indexDescription(indexStatus)}
                  </p>
                </div>
                <Badge
                  data-testid="settings-retrieval-index-status"
                  variant={indexStatus.state === "ready" ? "secondary" : "outline"}
                >
                  {semanticEnabled && !status.downloaded
                    ? "等待模型"
                    : indexStatusLabel(indexStatus.state)}
                </Badge>
              </div>
              {indexStatus.state === "indexing" ? (
                <>
                  <Progress
                    data-testid="settings-retrieval-index-progress"
                    value={indexStatus.progress?.percent ?? 0}
                    className="mt-3"
                  />
                  {indexStatus.progress ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {indexProgressLabel(indexStatus.progress)}
                    </p>
                  ) : null}
                </>
              ) : null}
              {indexStatus.state === "error" && indexStatus.error ? (
                <p className="mt-2 text-xs text-destructive">{indexStatus.error}</p>
              ) : null}
              {semanticEnabled && !status.downloaded ? (
                <p className="mt-2 text-xs text-muted-foreground">先下载模型再构建语义索引。</p>
              ) : null}
              <Button
                data-testid="settings-retrieval-rebuild-button"
                type="button"
                size="sm"
                variant="outline"
                className="mt-4"
                disabled={!canRebuildIndex}
                onClick={() => void handleRebuildIndex()}
              >
                {indexing ? "重建中" : "重新构建检索索引"}
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
