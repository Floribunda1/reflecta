import type { MermaidConfig, RenderResult } from "mermaid";

const defaultConfig: MermaidConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
};

let mermaidModule: Promise<typeof import("mermaid")> | undefined;
let renderQueue = Promise.resolve();

export function renderMermaid(
  id: string,
  source: string,
  config?: MermaidConfig,
): Promise<RenderResult> {
  const render = async () => {
    const { default: mermaid } = await (mermaidModule ??= import("mermaid"));
    mermaid.initialize({ ...defaultConfig, ...config });
    return mermaid.render(id, source);
  };
  const result = renderQueue.then(render);

  // ponytail: Mermaid is a singleton; serialize renders until parallel throughput matters.
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
