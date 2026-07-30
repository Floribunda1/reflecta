import { chromium } from "@playwright/test";
import { build, preview } from "vite";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

type Renderer = "markstream" | "streamdown";

type Scenario = {
  name: string;
  turns: number;
  blocksPerTurn: number;
};

type BrowserMeasurement = {
  domNodes: number;
  rendererNodes: number;
  scrollHeight: number;
  heapBytes?: number;
  visibleSpacerFrames: number;
  blankFrames: number;
  scrollHeightDrift: number;
  scrollFrameP50Ms: number;
  scrollFrameP95Ms: number;
  scrollFrameMaxMs: number;
  anchorDriftPx: number;
};

type BenchmarkRun = BrowserMeasurement & {
  renderer: Renderer;
  scenario: string;
  turns: number;
  blocksPerTurn: number;
  repeat: number;
  openMs: number;
  settleMs: number;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = path.join(rootDir, "packages/ui/benchmarks/chat-markdown");
const outputPath = process.env.BENCHMARK_OUTPUT
  ? path.resolve(rootDir, process.env.BENCHMARK_OUTPUT)
  : path.join(rootDir, "docs/iterations/v1.3.4/chat-markdown-benchmark.raw.json");
const outputDir = path.dirname(outputPath);

const allScenarios: Scenario[] = [
  { name: "sustained-long", turns: 100, blocksPerTurn: 120 },
  { name: "year-long-extreme", turns: 100, blocksPerTurn: 400 },
  { name: "single-pathological", turns: 1, blocksPerTurn: 5000 },
];

const repeats = Number.parseInt(process.env.BENCHMARK_REPEATS ?? "3", 10);
const selectedScenarioNames = new Set(
  process.env.BENCHMARK_SCENARIOS?.split(",").filter(Boolean) ?? [],
);
const scenarios = selectedScenarioNames.size
  ? allScenarios.filter((scenario) => selectedScenarioNames.has(scenario.name))
  : allScenarios;
const selectedRendererNames = new Set(
  process.env.BENCHMARK_RENDERERS?.split(",").filter(Boolean) ?? [],
);
const renderers = (["streamdown", "markstream"] satisfies Renderer[]).filter(
  (renderer) => !selectedRendererNames.size || selectedRendererNames.has(renderer),
);

function percentile(values: number[], ratio: number) {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

async function waitForStableLayout(page: import("@playwright/test").Page) {
  const startedAt = performance.now();
  let stableSamples = 0;
  let previous = "";

  while (performance.now() - startedAt < 60_000) {
    const current = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#scroll-root");
      return `${document.getElementsByTagName("*").length}:${root?.scrollHeight ?? 0}`;
    });
    stableSamples = current === previous ? stableSamples + 1 : 0;
    if (stableSamples >= 10) break;
    previous = current;
    await page.waitForTimeout(100);
  }

  return performance.now() - startedAt;
}

async function measurePage(page: import("@playwright/test").Page): Promise<BrowserMeasurement> {
  return page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#scroll-root");
    if (!root) throw new Error("Missing benchmark scroll root");

    const frameDurations: number[] = [];
    const heights: number[] = [];
    let visibleSpacerFrames = 0;
    let blankFrames = 0;
    const rootRect = root.getBoundingClientRect();
    const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
    const positions = [
      ...Array.from({ length: 120 }, (_, index) => (maxScrollTop * index) / 119),
      ...Array.from({ length: 120 }, (_, index) => maxScrollTop * (1 - index / 119)),
    ];

    for (const position of positions) {
      const before = performance.now();
      root.scrollTop = position;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      frameDurations.push(performance.now() - before);
      heights.push(root.scrollHeight);

      const spacerVisible = Array.from(root.querySelectorAll<HTMLElement>(".node-spacer")).some(
        (spacer) => {
          const rect = spacer.getBoundingClientRect();
          return rect.height > 0 && rect.bottom > rootRect.top && rect.top < rootRect.bottom;
        },
      );
      if (spacerVisible) visibleSpacerFrames += 1;

      const center = document.elementFromPoint(
        rootRect.left + Math.min(rootRect.width / 2, 360),
        rootRect.top + rootRect.height / 2,
      );
      if (
        !center ||
        center === root ||
        center.id === "benchmark-app" ||
        center.closest(".node-spacer")
      ) {
        blankFrames += 1;
      }
    }

    root.scrollTop = maxScrollTop * 0.6;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const anchorBefore = root.scrollTop;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const anchorDriftPx = Math.abs(root.scrollTop - anchorBefore);

    const sortedFrames = frameDurations.toSorted((left, right) => left - right);
    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }
    ).memory;

    return {
      domNodes: document.getElementsByTagName("*").length,
      rendererNodes: root.querySelectorAll(
        ".node-slot, [data-streamdown], [data-streamdown='code-block']",
      ).length,
      scrollHeight: root.scrollHeight,
      heapBytes: memory?.usedJSHeapSize,
      visibleSpacerFrames,
      blankFrames,
      scrollHeightDrift: Math.max(...heights) - Math.min(...heights),
      scrollFrameP50Ms: sortedFrames[Math.floor(sortedFrames.length * 0.5)] ?? 0,
      scrollFrameP95Ms: sortedFrames[Math.floor(sortedFrames.length * 0.95)] ?? 0,
      scrollFrameMaxMs: sortedFrames.at(-1) ?? 0,
      anchorDriftPx,
    };
  });
}

async function main() {
  const buildDir = await mkdtemp(path.join(tmpdir(), "reflecta-chat-markdown-benchmark-"));
  await build({
    root: fixtureDir,
    logLevel: "error",
    build: { outDir: buildDir, emptyOutDir: true },
  });
  const server = await preview({
    root: fixtureDir,
    logLevel: "error",
    build: { outDir: buildDir },
    preview: { host: "127.0.0.1", port: 0 },
  });

  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error("Vite did not expose a local benchmark URL");

  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info"],
  });
  const browserVersion = browser.version();
  const runs: BenchmarkRun[] = [];

  try {
    for (const scenario of scenarios) {
      for (const renderer of renderers) {
        for (let repeat = 1; repeat <= repeats; repeat += 1) {
          const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
          const url = new URL(baseUrl);
          url.searchParams.set("renderer", renderer);
          url.searchParams.set("turns", String(scenario.turns));
          url.searchParams.set("blocks", String(scenario.blocksPerTurn));

          const openedAt = performance.now();
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
          await page.waitForFunction(
            () => window.__CHAT_MARKDOWN_BENCHMARK_READY__ === true,
            null,
            {
              timeout: 120_000,
            },
          );
          const openMs = performance.now() - openedAt;
          const settleMs = await waitForStableLayout(page);
          const measurement = await measurePage(page);
          const run = {
            renderer,
            scenario: scenario.name,
            turns: scenario.turns,
            blocksPerTurn: scenario.blocksPerTurn,
            repeat,
            openMs,
            settleMs,
            ...measurement,
          };
          runs.push(run);
          console.log(
            [
              renderer,
              scenario.name,
              `#${repeat}`,
              `open=${openMs.toFixed(0)}ms`,
              `dom=${measurement.domNodes}`,
              `p95=${measurement.scrollFrameP95Ms.toFixed(1)}ms`,
              `spacer=${measurement.visibleSpacerFrames}`,
              `blank=${measurement.blankFrames}`,
              `drift=${measurement.scrollHeightDrift}px`,
            ].join(" "),
          );
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(buildDir, { recursive: true, force: true });
  }

  const summaries = scenarios.flatMap((scenario) =>
    renderers.map((renderer) => {
      const matching = runs.filter(
        (run) => run.renderer === renderer && run.scenario === scenario.name,
      );
      return {
        renderer,
        scenario: scenario.name,
        turns: scenario.turns,
        blocksPerTurn: scenario.blocksPerTurn,
        repeats: matching.length,
        medianOpenMs: percentile(
          matching.map((run) => run.openMs),
          0.5,
        ),
        medianDomNodes: percentile(
          matching.map((run) => run.domNodes),
          0.5,
        ),
        medianHeapBytes: percentile(
          matching.flatMap((run) => (run.heapBytes == null ? [] : [run.heapBytes])),
          0.5,
        ),
        medianScrollFrameP95Ms: percentile(
          matching.map((run) => run.scrollFrameP95Ms),
          0.5,
        ),
        maxVisibleSpacerFrames: Math.max(...matching.map((run) => run.visibleSpacerFrames)),
        maxBlankFrames: Math.max(...matching.map((run) => run.blankFrames)),
        maxScrollHeightDrift: Math.max(...matching.map((run) => run.scrollHeightDrift)),
        maxAnchorDriftPx: Math.max(...matching.map((run) => run.anchorDriftPx)),
      };
    }),
  );

  await mkdir(outputDir, { recursive: true });
  await Bun.write(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: {
          platform: process.platform,
          arch: process.arch,
          bun: Bun.version,
          browser: browserVersion,
        },
        methodology: {
          priority: ["functional reliability", "performance", "experience"],
          renderers: {
            markstream: "markstream-react@0.0.55, final render, package defaults",
            streamdown: "streamdown@2.5.0, mode=static",
          },
          scrollFramesPerRun: 240,
          repeats,
        },
        summaries,
        runs,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`raw results: ${outputPath}`);

  if (
    process.env.BENCHMARK_FAIL_ON_BLANKS === "1" &&
    summaries.some((summary) => summary.maxBlankFrames > 0)
  ) {
    throw new Error("Visible blank frames detected while scrolling the Markdown transcript");
  }
}

await main();

declare global {
  interface Window {
    __CHAT_MARKDOWN_BENCHMARK_READY__?: boolean;
  }
}
