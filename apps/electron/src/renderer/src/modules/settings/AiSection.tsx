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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold leading-none text-foreground">AI</h3>
        <p className="mt-2 text-sm text-muted-foreground">用于摘要标题生成等辅助能力。</p>
      </div>

      <div className="flex flex-col gap-4">
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
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={loading}
          className="bg-primary text-white"
          onClick={() => void handleSave()}
        >
          <Check size={15} />
          保存
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle size={14} />
            已保存
          </span>
        )}
      </div>
    </div>
  );
}
