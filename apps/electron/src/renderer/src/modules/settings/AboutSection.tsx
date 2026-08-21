import { useCallback, useEffect, useState, type ReactNode } from "react";
import { runPromise } from "@renderer/lib/effect-runtime";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ExternalLink, Package, RefreshCw } from "lucide-react";
import { Badge } from "@reflecta/ui/components/badge";
import { Button } from "@reflecta/ui/components/button";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@reflecta/ui/components/item";
import { cn } from "@reflecta/ui/lib/utils";
import { toast } from "sonner";
import { rpc } from "@renderer/lib/effect-rpc";
import type { AboutVersionInfo, UpdateCheckFinishedPayload } from "@shared/update";
import { UPDATE_CHECK_FINISHED_CHANNEL } from "@shared/update";
import { renderError } from "@renderer/lib/errors";

const PROJECT_URL = "https://github.com/Floribunda1/reflecta";
const RELEASES_URL = `${PROJECT_URL}/releases`;

function OutboundLink({
  href,
  testId,
  children,
}: {
  href: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-testid={testId}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
    >
      {children}
      <ExternalLink size={11} />
    </a>
  );
}

export function AboutSection() {
  const [info, setInfo] = useState<AboutVersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await runPromise(rpc.aboutGetVersionInfo());
      setInfo(next);
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
      console.error("[About] load version info failed", error);
    }
  }, []);

  useEffect(() => {
    void refresh();

    // 更新检查结束后主进程广播事件，面板借此退出「正在检查」并刷新最近检查时间。
    const listener = (_event: unknown, payload: unknown) => {
      const result = payload as UpdateCheckFinishedPayload | undefined;
      setChecking(false);
      void refresh();
      if (result?.failed) {
        toast.error("检查更新失败", {
          description: "请稍后重试，或前往发布页手动查看最新版本",
        });
      }
    };
    window.ipcRenderer.on(UPDATE_CHECK_FINISHED_CHANNEL, listener);
    return () => {
      window.ipcRenderer.removeListener(UPDATE_CHECK_FINISHED_CHANNEL, listener);
    };
  }, [refresh]);

  const handleCheckForUpdates = async () => {
    if (!info?.updateCheckSupported || checking) return;
    setChecking(true);
    try {
      const { started } = await runPromise(rpc.aboutCheckForUpdates());
      if (!started) setChecking(false);
      // 启动成功后保持「正在检查」，Sparkle 前台检查会自行弹出结果窗口；
      // 若完成事件未到达，重新打开面板会经 getVersionInfo 兜底刷新。
    } catch (error) {
      setChecking(false);
      toast.error("检查更新失败", { description: renderError(error) });
    }
  };

  const lastCheckLabel = info?.lastCheckAt
    ? formatDistanceToNow(info.lastCheckAt, { addSuffix: true, locale: zhCN })
    : "尚未检查更新";

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-base font-medium text-foreground">关于</h3>
        <p className="mt-1 text-sm text-muted-foreground">应用版本、更新渠道与许可信息。</p>
      </div>

      <section className="section-divider">
        <div>
          <h4 className="text-sm font-medium text-foreground">版本</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {info?.name ?? "Reflecta"} 标识版本与运行架构，帮助你确认当前安装的构建。
          </p>
        </div>

        {loadFailed ? (
          <p className="mt-3 text-xs text-muted-foreground">版本信息加载失败，请稍后重试。</p>
        ) : (
          <div className="mt-3 space-y-3">
            <Item variant="outline" size="xs" className="min-w-0">
              <ItemMedia variant="icon">
                <Package size={15} className="shrink-0 text-muted-foreground" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{info?.name ?? "Reflecta"}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Badge variant="secondary" data-testid="settings-about-version">
                  v{info?.version ?? "—"}（{info?.arch ?? "—"}）
                </Badge>
              </ItemActions>
            </Item>

            <Item variant="outline" size="xs" className="min-w-0">
              <ItemMedia variant="icon">
                <RefreshCw size={15} className="shrink-0 text-muted-foreground" />
              </ItemMedia>
              <ItemContent>
                <span className="text-xs text-muted-foreground">上次检查</span>
                <span
                  data-testid="settings-about-last-check"
                  className="mt-0.5 text-sm text-foreground"
                >
                  {lastCheckLabel}
                </span>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="settings-about-check-button"
                  disabled={!info?.updateCheckSupported || checking}
                  onClick={() => void handleCheckForUpdates()}
                >
                  <RefreshCw size={14} className={cn("shrink-0", checking && "animate-spin")} />
                  {checking ? "正在检查" : "检查更新"}
                </Button>
              </ItemActions>
            </Item>

            {info && !info.updateCheckSupported ? (
              <p className="text-xs leading-5 text-muted-foreground">
                当前环境不支持自动更新，检查更新仅适用于 macOS 安装版；Windows / Linux
                构建可在发布页手动查看最新版本。
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="section-divider">
        <div>
          <h4 className="text-sm font-medium text-foreground">项目</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            查看源码、提交反馈或获取最新版本。
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <OutboundLink href={PROJECT_URL} testId="settings-about-repo-link">
            GitHub 仓库
          </OutboundLink>
          <OutboundLink href={RELEASES_URL} testId="settings-about-releases-link">
            发布页
          </OutboundLink>
        </div>
      </section>

      <section className="section-divider">
        <div>
          <h4 className="text-sm font-medium text-foreground">许可</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Reflecta 自有代码采用 MIT License 发布；macOS 更新组件由{" "}
            <a
              href="https://sparkle-project.org"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sparkle
            </a>{" "}
            提供，遵循其相应许可。第三方依赖遵循各自的许可证。
          </p>
        </div>
      </section>
    </div>
  );
}
