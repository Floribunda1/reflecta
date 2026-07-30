import MarkdownRender from "markstream-react";
import { useLayoutEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Streamdown } from "streamdown";
import "markstream-react/index.css";
import "streamdown/styles.css";
import "./style.css";

type Renderer = "markstream" | "streamdown";

const params = new URLSearchParams(window.location.search);
const renderer: Renderer = params.get("renderer") === "streamdown" ? "streamdown" : "markstream";
const turns = Number.parseInt(params.get("turns") ?? "100", 10);
const blocksPerTurn = Number.parseInt(params.get("blocks") ?? "120", 10);

function markdownBlock(turn: number, index: number) {
  if (index % 50 === 0) {
    return [
      "```ts",
      `export function turn${turn}Block${index}(value: number) {`,
      `  return value * ${index + 1};`,
      "}",
      "```",
    ].join("\n");
  }
  if (index % 25 === 0) {
    return [
      `| Turn ${turn} | Block ${index} | Status |`,
      "| --- | ---: | --- |",
      `| long transcript | ${index} | retained |`,
      `| restored context | ${index + 1} | verified |`,
    ].join("\n");
  }
  if (index % 10 === 0) {
    return [
      `## Turn ${turn}, section ${index}`,
      "",
      `- preserves context for block ${index}`,
      `- keeps navigation stable for turn ${turn}`,
      `- renders **formatted text** and \`inline code\``,
    ].join("\n");
  }
  if (index % 7 === 0) {
    return `> Turn ${turn} block ${index} keeps a concrete observation attached to the surrounding reasoning.`;
  }
  return `Turn ${turn}, paragraph ${index}. This is a deliberately long AI response used to restore a year-long conversation. It contains enough prose to wrap across multiple lines and exercise real message heights without application-level containment.`;
}

function markdownForTurn(turn: number) {
  return Array.from({ length: blocksPerTurn }, (_, index) => markdownBlock(turn, index)).join(
    "\n\n",
  );
}

function BenchmarkMarkdown({ value }: { value: string }) {
  if (renderer === "streamdown") {
    return <Streamdown mode="static">{value}</Streamdown>;
  }
  return (
    <MarkdownRender
      content={value}
      final
      fade={false}
      smoothStreaming={false}
      showTooltips={false}
    />
  );
}

function Turn({ index }: { index: number }) {
  return (
    <section className="turn" data-turn={index}>
      <div className="user-message">Continue the long-running discussion for turn {index}.</div>
      <article className="assistant-message">
        <BenchmarkMarkdown value={markdownForTurn(index)} />
      </article>
    </section>
  );
}

function BenchmarkApp(): ReactNode {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__CHAT_MARKDOWN_BENCHMARK_READY__ = true;
      });
    });
  }, []);

  return (
    <main id="scroll-root">
      <div id="transcript">
        {Array.from({ length: turns }, (_, index) => (
          <Turn key={index} index={index + 1} />
        ))}
      </div>
    </main>
  );
}

createRoot(document.querySelector("#benchmark-app")!).render(<BenchmarkApp />);

declare global {
  interface Window {
    __CHAT_MARKDOWN_BENCHMARK_READY__?: boolean;
  }
}
