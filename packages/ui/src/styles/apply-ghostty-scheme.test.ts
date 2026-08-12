// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import {
  applyGhosttyScheme,
  chromaticSwatches,
  contrastForeground,
  DEFAULT_PRIMARY_SLOT,
} from "./apply-ghostty-scheme";
import { DEFAULT_GHOSTTY_SCHEME, PAIRED_THEMES } from "./ghostty-themes";

describe("contrastForeground", () => {
  test("picks dark text on a light accent", () => {
    expect(contrastForeground("#ffaa33", "#000000", "#f8f9fa")).toBe("#000000");
  });

  test("picks light text on a dark accent", () => {
    expect(contrastForeground("#0969da", "#000000", "#ffffff")).toBe("#ffffff");
  });
});

describe("chromaticSwatches", () => {
  test("exposes the eight Base16 accent slots for the default palette", () => {
    const swatches = chromaticSwatches();
    expect(swatches.map((item) => item.key)).toEqual([
      "base08",
      "base09",
      "base0a",
      "base0b",
      "base0c",
      "base0d",
      "base0e",
      "base0f",
    ]);
    expect(swatches[5]?.light).toBe("#3c6fb4");
  });
});

describe("applyGhosttyScheme", () => {
  const ayu = PAIRED_THEMES.find((theme) => theme.name === "Ayu");
  const apple = PAIRED_THEMES.find((theme) => theme.name === DEFAULT_GHOSTTY_SCHEME);
  if (!ayu) throw new Error("missing Ayu");
  if (!apple) throw new Error("missing Apple System Colors");

  test("uses Ghostty cursor-color as primary instead of cyan", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, ayu, "light");
    expect(root.style.getPropertyValue("--primary")).toBe("#ffaa33");
    expect(root.style.getPropertyValue("--ring")).toBe("#ffaa33");
    expect(root.style.getPropertyValue("--base0c")).toBe("#46ba94");
    expect(root.style.getPropertyValue("--primary-foreground")).toBe("#000000");
  });

  test("applies the dark cursor-color in dark mode", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, ayu, "dark");
    expect(root.style.getPropertyValue("--primary")).toBe("#e6b450");
    expect(root.style.getPropertyValue("--base0c")).toBe("#90e1c6");
  });

  test("clears injected variables for the default scheme", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, ayu, "light");
    applyGhosttyScheme(root, null, "light");
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--base00")).toBe("");
  });

  test("overrides primary with a Base16 chromatic slot", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, ayu, "light", 13);
    expect(root.style.getPropertyValue("--primary")).toBe(ayu.light[13]);
    expect(root.style.getPropertyValue("--ring")).toBe(ayu.light[13]);
    expect(root.style.getPropertyValue("--primary")).not.toBe(ayu.lightAccent);
  });

  test("applies a chromatic slot on the default scheme without injecting bases", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, null, "light", 13);
    expect(root.style.getPropertyValue("--primary")).toBe("#3c6fb4");
    expect(root.style.getPropertyValue("--base00")).toBe("");
  });

  test("falls back to the theme cursor-color when the slot is cleared", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, ayu, "light", 13);
    applyGhosttyScheme(root, ayu, "light", null);
    expect(root.style.getPropertyValue("--primary")).toBe(ayu.lightAccent);
  });

  test("defaults Apple System Colors primary to base0D", () => {
    const root = document.createElement("div");
    applyGhosttyScheme(root, apple, "light", DEFAULT_PRIMARY_SLOT);
    expect(root.style.getPropertyValue("--primary")).toBe(apple.light[13]);
    expect(root.style.getPropertyValue("--primary")).toBe("#0869cb");
  });
});
