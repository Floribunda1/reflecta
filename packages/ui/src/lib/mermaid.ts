import type { MermaidConfig, RenderResult } from "mermaid";

const defaultConfig: MermaidConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  theme: "base",
};

const commonThemeVariables = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: "14px",
  radius: 0,
  strokeWidth: 1,
  useGradient: false,
  dropShadow: "none",
};

function getThemeVariables(): MermaidConfig["themeVariables"] {
  const dark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const palette = dark
    ? {
        background: "#1e1e1e",
        surface: "#252526",
        surfaceMuted: "#2d2d30",
        cluster: "#181818",
        text: "#cccccc",
        border: "#454545",
        accent: "#3794ff",
        active: "#2d2d30",
        done: "#454545",
        pie: ["#3794ff", "#5278a3", "#687f99", "#7f8994"],
      }
    : {
        background: "#ffffff",
        surface: "#f8f8fa",
        surfaceMuted: "#f3f3f3",
        cluster: "#ffffff",
        text: "#1f1f1f",
        border: "#d4d4d4",
        accent: "#007acc",
        active: "#e7f3ff",
        done: "#e5e5e5",
        pie: ["#007acc", "#387da5", "#5d8298", "#758692"],
      };

  return {
    ...commonThemeVariables,
    darkMode: dark,
    background: palette.background,
    primaryColor: palette.surface,
    primaryTextColor: palette.text,
    primaryBorderColor: palette.accent,
    secondaryColor: palette.surfaceMuted,
    secondaryTextColor: palette.text,
    secondaryBorderColor: palette.accent,
    tertiaryColor: palette.cluster,
    tertiaryTextColor: palette.text,
    tertiaryBorderColor: palette.border,
    lineColor: palette.accent,
    arrowheadColor: palette.accent,
    textColor: palette.text,
    edgeLabelBackground: palette.background,
    actorBorder: palette.accent,
    actorBkg: palette.surface,
    actorTextColor: palette.text,
    actorLineColor: palette.accent,
    signalColor: palette.accent,
    signalTextColor: palette.text,
    labelBoxBkgColor: palette.background,
    labelBoxBorderColor: palette.accent,
    labelTextColor: palette.text,
    loopTextColor: palette.text,
    activationBorderColor: palette.accent,
    activationBkgColor: palette.surfaceMuted,
    sequenceNumberColor: "#ffffff",
    transitionColor: palette.accent,
    transitionLabelColor: palette.text,
    stateLabelColor: palette.text,
    stateBkg: palette.surface,
    labelBackgroundColor: palette.background,
    compositeBackground: palette.cluster,
    compositeBorder: palette.border,
    sectionBkgColor: palette.background,
    altSectionBkgColor: palette.surface,
    sectionBkgColor2: palette.surface,
    taskBorderColor: palette.accent,
    taskBkgColor: palette.surface,
    activeTaskBorderColor: palette.accent,
    activeTaskBkgColor: palette.active,
    doneTaskBorderColor: palette.border,
    doneTaskBkgColor: palette.done,
    critBorderColor: palette.accent,
    critBkgColor: palette.active,
    gridColor: palette.border,
    todayLineColor: palette.accent,
    taskTextColor: palette.text,
    taskTextOutsideColor: palette.text,
    pie1: palette.pie[0],
    pie2: palette.pie[1],
    pie3: palette.pie[2],
    pie4: palette.pie[3],
    pieTitleTextColor: palette.text,
    pieSectionTextColor: "#ffffff",
    pieLegendTextColor: palette.text,
    pieStrokeColor: palette.border,
    pieOuterStrokeColor: palette.border,
  };
}

let mermaidModule: Promise<typeof import("mermaid")> | undefined;
let renderQueue = Promise.resolve();

export function renderMermaid(
  id: string,
  source: string,
  config?: MermaidConfig,
): Promise<RenderResult> {
  const render = async () => {
    const { default: mermaid } = await (mermaidModule ??= import("mermaid"));
    mermaid.initialize({ ...defaultConfig, themeVariables: getThemeVariables(), ...config });
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
