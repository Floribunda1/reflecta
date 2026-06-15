import { useEffect, useState } from "react";
import { Check, CheckCircle } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { ipcClient } from "@renderer/utils/ipc";

export function AiSection() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void ipcClient.config.getAiConfig().then((config) => {
      setApiKey(config.apiKey);
      setBaseUrl(config.baseUrl);
      setModel(config.model);
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await ipcClient.config.setAiConfig({ apiKey, baseUrl, model });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-medium text-foreground">AI</h3>
        <p className="mt-2 text-sm text-muted-foreground">用于摘要标题生成等辅助能力。</p>
      </div>

      <section className="border-t border-border/70 pt-5">
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            <h4 className="text-sm font-medium text-foreground">模型配置</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              配置用于本地辅助能力的兼容接口。
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">API Key</span>
              <Input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                placeholder="sk-..."
                className="font-mono"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Base URL</span>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                className="font-mono"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Model</span>
              <Input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o"
                className="font-mono"
              />
            </label>

            <div className="flex items-center gap-3">
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
        </div>
      </section>
    </div>
  );
}
