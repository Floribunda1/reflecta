import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";

// ─── Reflecta Preset ──────────────────────────────────────────────────────────
// Notion-inspired design system for PrimeVue 4.x.
//
// Design philosophy: warm neutrals, whisper borders, and barely-there shadows.
// Only the light color scheme is provided — dark mode is intentionally omitted.
//
// See docs/2-design/DESIGN.md for the full design specification.
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SHADOW =
  "rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.84688px, rgba(0,0,0,0.02) 0px 0.8px 2.925px, rgba(0,0,0,0.01) 0px 0.175px 1.04062px";

const DEEP_SHADOW =
  "rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px";

const WHISPER_BORDER = "rgba(0, 0, 0, 0.1)";

export const ReflectaPreset = definePreset(Aura, {
  primitive: {
    notionBlue: {
      50: "#f2f9ff",
      100: "#e6f2ff",
      200: "#c2e0ff",
      300: "#94cbff",
      400: "#62aef0",
      500: "#0075de",
      600: "#005bab",
      700: "#004a94",
      800: "#003a75",
      900: "#002957",
      950: "#001a38",
    },
    warmNeutral: {
      0: "#ffffff",
      50: "#f6f5f4",
      100: "#ecebe9",
      200: "#dddcd9",
      300: "#c5c1bc",
      400: "#a39e98",
      500: "#615d59",
      600: "#4a4744",
      700: "#3d3b38",
      800: "#31302e",
      900: "#1a1918",
      950: "#0d0c0b",
    },
    semanticAccent: {
      teal: "#2a9d99",
      green: "#1aae39",
      orange: "#dd5b00",
      pink: "#ff64c8",
      purple: "#391c57",
      brown: "#523410",
    },
  },
  semantic: {
    focusRing: {
      width: "2px",
      style: "solid",
      color: "#097fe8",
      offset: "2px",
      shadow: "0 0 0 3px rgba(9, 127, 232, 0.15)",
    },
    primary: {
      50: "{notionBlue.50}",
      100: "{notionBlue.100}",
      200: "{notionBlue.200}",
      300: "{notionBlue.300}",
      400: "{notionBlue.400}",
      500: "{notionBlue.500}",
      600: "{notionBlue.600}",
      700: "{notionBlue.700}",
      800: "{notionBlue.800}",
      900: "{notionBlue.900}",
      950: "{notionBlue.950}",
    },
    formField: {
      borderRadius: "4px",
      paddingX: "0.75rem",
      paddingY: "0.5rem",
      shadow: "none",
      focusRing: {
        width: "2px",
        style: "solid",
        color: "#097fe8",
        offset: "-1px",
        shadow: "0 0 0 3px rgba(9, 127, 232, 0.15)",
      },
    },
    content: {
      borderRadius: "8px",
    },
    list: {
      padding: "0.25rem",
      gap: "0.125rem",
      option: {
        padding: "0.5rem 0.625rem",
        borderRadius: "{border.radius.md}",
      },
    },
    navigation: {
      list: {
        padding: "0.25rem",
        gap: "0.125rem",
      },
      item: {
        padding: "0.5rem 0.625rem",
        borderRadius: "{border.radius.lg}",
        gap: "0.5rem",
      },
    },
    overlay: {
      select: {
        borderRadius: "8px",
        borderColor: WHISPER_BORDER,
        shadow: CARD_SHADOW,
      },
      popover: {
        borderRadius: "8px",
        borderColor: WHISPER_BORDER,
        shadow: CARD_SHADOW,
      },
      modal: {
        borderRadius: "12px",
        borderColor: WHISPER_BORDER,
        shadow: DEEP_SHADOW,
      },
      navigation: {
        shadow: CARD_SHADOW,
      },
    },
    colorScheme: {
      light: {
        surface: {
          0: "{warmNeutral.0}",
          50: "{warmNeutral.50}",
          100: "{warmNeutral.100}",
          200: "{warmNeutral.200}",
          300: "{warmNeutral.300}",
          400: "{warmNeutral.400}",
          500: "{warmNeutral.500}",
          600: "{warmNeutral.600}",
          700: "{warmNeutral.700}",
          800: "{warmNeutral.800}",
          900: "{warmNeutral.900}",
          950: "{warmNeutral.950}",
        },
        primary: {
          color: "{primary.500}",
          contrastColor: "#ffffff",
          hoverColor: "{primary.600}",
          activeColor: "{primary.700}",
        },
        highlight: {
          background: "rgba(0, 117, 222, 0.08)",
          focusBackground: "rgba(0, 117, 222, 0.12)",
          color: "{primary.600}",
          focusColor: "{primary.700}",
        },
        text: {
          color: "rgba(0, 0, 0, 0.95)",
          hoverColor: "rgba(0, 0, 0, 0.95)",
          mutedColor: "{surface.500}",
          hoverMutedColor: "{surface.700}",
        },
        content: {
          background: "{surface.0}",
          hoverBackground: "{surface.50}",
          borderColor: WHISPER_BORDER,
          color: "{text.color}",
          hoverColor: "{text.hover.color}",
        },
        formField: {
          background: "{surface.0}",
          borderColor: "#dddddd",
          hoverBorderColor: "{surface.300}",
          focusBorderColor: "{primary.400}",
          color: "rgba(0, 0, 0, 0.9)",
          placeholderColor: "{text.muted.color}",
          shadow: "none",
        },
        list: {
          option: {
            focusBackground: "{surface.50}",
            selectedBackground: "rgba(0, 117, 222, 0.08)",
            selectedFocusBackground: "rgba(0, 117, 222, 0.12)",
            color: "{text.color}",
            focusColor: "{text.hover.color}",
            selectedColor: "{text.color}",
            selectedFocusColor: "{text.color}",
          },
        },
        navigation: {
          item: {
            focusBackground: "{surface.50}",
            activeBackground: "rgba(0, 117, 222, 0.08)",
            color: "{text.muted.color}",
            focusColor: "{text.hover.color}",
            activeColor: "{text.hover.color}",
            icon: {
              color: "{text.muted.color}",
              focusColor: "{text.hover.muted.color}",
              activeColor: "{primary.500}",
            },
          },
        },
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: "4px",
        paddingX: "1rem",
        paddingY: "0.5rem",
        label: {
          fontWeight: "600",
        },
      },
      colorScheme: {
        light: {
          root: {
            primary: {
              background: "{primary.500}",
              hoverBackground: "{primary.600}",
              activeBackground: "{primary.700}",
              borderColor: "{primary.500}",
              hoverBorderColor: "{primary.600}",
              activeBorderColor: "{primary.700}",
              color: "{primary.contrast.color}",
              hoverColor: "{primary.contrast.color}",
              activeColor: "{primary.contrast.color}",
            },
            secondary: {
              background: "rgba(0, 0, 0, 0.05)",
              hoverBackground: "rgba(0, 0, 0, 0.08)",
              activeBackground: "rgba(0, 0, 0, 0.12)",
              borderColor: "transparent",
              hoverBorderColor: "transparent",
              activeBorderColor: "transparent",
              color: "rgba(0, 0, 0, 0.95)",
              hoverColor: "rgba(0, 0, 0, 0.95)",
              activeColor: "rgba(0, 0, 0, 0.95)",
            },
            success: {
              background: "{semanticAccent.teal}",
              hoverBackground: "#258c88",
              activeBackground: "#1f7a77",
              borderColor: "{semanticAccent.teal}",
              hoverBorderColor: "#258c88",
              activeBorderColor: "#1f7a77",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
            },
            info: {
              background: "{primary.500}",
              hoverBackground: "{primary.600}",
              activeBackground: "{primary.700}",
              borderColor: "{primary.500}",
              hoverBorderColor: "{primary.600}",
              activeBorderColor: "{primary.700}",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
            },
            warn: {
              background: "{semanticAccent.orange}",
              hoverBackground: "#c45200",
              activeBackground: "#ab4800",
              borderColor: "{semanticAccent.orange}",
              hoverBorderColor: "#c45200",
              activeBorderColor: "#ab4800",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
            },
            danger: {
              background: "#dc2626",
              hoverBackground: "#b91c1c",
              activeBackground: "#991b1b",
              borderColor: "#dc2626",
              hoverBorderColor: "#b91c1c",
              activeBorderColor: "#991b1b",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
            },
            contrast: {
              background: "{surface.800}",
              hoverBackground: "{surface.900}",
              activeBackground: "{surface.950}",
              borderColor: "{surface.800}",
              hoverBorderColor: "{surface.900}",
              activeBorderColor: "{surface.950}",
              color: "{surface.0}",
              hoverColor: "{surface.0}",
              activeColor: "{surface.0}",
            },
          },
          outlined: {
            primary: {
              hoverBackground: "{primary.50}",
              activeBackground: "{primary.100}",
              borderColor: "{primary.500}",
              color: "{primary.500}",
            },
            secondary: {
              hoverBackground: "{surface.50}",
              activeBackground: "{surface.100}",
              borderColor: "{surface.300}",
              color: "{text.muted.color}",
            },
          },
          text: {
            primary: {
              color: "{primary.500}",
              hoverBackground: "{primary.50}",
              activeBackground: "{primary.100}",
            },
            secondary: {
              color: "{text.muted.color}",
              hoverBackground: "{surface.50}",
              activeBackground: "{surface.100}",
            },
          },
        },
      },
    },
    tabs: {
      tablist: {
        borderWidth: "0",
        background: "transparent",
      },
      tab: {
        borderWidth: "0",
        borderColor: "transparent",
        hoverBorderColor: "transparent",
        activeBorderColor: "transparent",
        padding: "0.375rem 0.625rem",
        fontWeight: "500",
        margin: "0",
      },
      activeBar: {
        height: "0",
        background: "transparent",
      },
      tabpanel: {
        padding: "0",
      },
      colorScheme: {
        light: {
          tab: {
            background: "transparent",
            color: "{text.muted.color}",
            hoverColor: "{text.hover.color}",
            activeColor: "{text.hover.color}",
            hoverBackground: "{surface.50}",
            activeBackground: "{surface.0}",
          },
        },
      },
    },
    tree: {
      root: {
        background: "transparent",
        padding: "0",
      },
      node: {
        padding: "0.375rem 0.625rem",
        borderRadius: "6px",
        hoverBackground: "{content.hover.background}",
        selectedBackground: "{highlight.background}",
        color: "{text.color}",
        hoverColor: "{text.hover.color}",
        selectedColor: "{text.color}",
        gap: "0.5rem",
      },
      nodeToggleButton: {
        size: "0.75rem",
        color: "{text.muted.color}",
        hoverColor: "{text.hover.muted.color}",
        hoverBackground: "{content.hover.background}",
      },
    },
    tag: {
      root: {
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "600",
        padding: "0.25rem 0.625rem",
        gap: "0.375rem",
      },
      icon: {
        size: "0.75rem",
      },
      primary: {
        background: "{primary.50}",
        color: "{primary.600}",
      },
      secondary: {
        background: "{surface.50}",
        color: "{surface.600}",
      },
      success: {
        background: "rgba(42, 157, 153, 0.1)",
        color: "{semanticAccent.teal}",
      },
      info: {
        background: "{primary.50}",
        color: "{primary.600}",
      },
      warn: {
        background: "rgba(221, 91, 0, 0.1)",
        color: "{semanticAccent.orange}",
      },
      danger: {
        background: "rgba(220, 38, 38, 0.1)",
        color: "#dc2626",
      },
      contrast: {
        background: "{surface.800}",
        color: "{surface.0}",
      },
    },
    card: {
      root: {
        background: "{surface.0}",
        borderRadius: "12px",
        color: "{text.color}",
        shadow: CARD_SHADOW,
      },
      body: {
        padding: "1.25rem",
        gap: "0.75rem",
      },
      caption: {
        gap: "0.25rem",
      },
      title: {
        fontSize: "1.375rem",
        fontWeight: "700",
      },
      subtitle: {
        color: "{text.muted.color}",
      },
    },
    chip: {
      root: {
        borderRadius: "9999px",
        paddingX: "0.75rem",
        paddingY: "0.375rem",
        gap: "0.5rem",
        background: "{surface.50}",
        color: "{text.color}",
      },
      image: {
        width: "1.75rem",
        height: "1.75rem",
      },
      icon: {
        size: "0.875rem",
        color: "{text.muted.color}",
      },
      removeIcon: {
        size: "0.875rem",
        color: "{text.muted.color}",
      },
    },
    dialog: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
        borderRadius: "12px",
        shadow: DEEP_SHADOW,
      },
      header: {
        padding: "1.25rem 1.5rem",
        gap: "0.75rem",
      },
      title: {
        fontSize: "1.25rem",
        fontWeight: "700",
      },
      content: {
        padding: "0 1.5rem 1.25rem 1.5rem",
      },
      footer: {
        padding: "0 1.5rem 1.25rem 1.5rem",
        gap: "0.5rem",
      },
    },
    drawer: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
        shadow: DEEP_SHADOW,
      },
      header: {
        padding: "1.25rem 1.5rem",
      },
      title: {
        fontSize: "1.25rem",
        fontWeight: "700",
      },
      content: {
        padding: "0 1.5rem 1.25rem 1.5rem",
      },
      footer: {
        padding: "0 1.5rem 1.25rem 1.5rem",
      },
    },
    menu: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
        borderRadius: "8px",
        shadow: CARD_SHADOW,
      },
      list: {
        padding: "0.25rem",
        gap: "0.125rem",
      },
      item: {
        focusBackground: "{surface.50}",
        color: "{text.color}",
        focusColor: "{text.hover.color}",
        padding: "0.5rem 0.625rem",
        borderRadius: "5px",
        gap: "0.5rem",
        icon: {
          color: "{text.muted.color}",
          focusColor: "{text.hover.muted.color}",
        },
      },
      submenuLabel: {
        padding: "0.5rem 0.625rem",
        fontWeight: "600",
        background: "transparent",
        color: "{text.muted.color}",
      },
      separator: {
        borderColor: WHISPER_BORDER,
      },
    },
    contextmenu: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
        borderRadius: "8px",
        shadow: CARD_SHADOW,
      },
      list: {
        padding: "0.25rem",
        gap: "0.125rem",
      },
      item: {
        focusBackground: "{surface.50}",
        activeBackground: "rgba(0, 117, 222, 0.08)",
        color: "{text.color}",
        focusColor: "{text.hover.color}",
        activeColor: "{text.hover.color}",
        padding: "0.5rem 0.625rem",
        borderRadius: "5px",
        gap: "0.5rem",
        icon: {
          color: "{text.muted.color}",
          focusColor: "{text.hover.muted.color}",
          activeColor: "{primary.500}",
        },
      },
      submenuIcon: {
        size: "0.875rem",
        color: "{text.muted.color}",
        focusColor: "{text.hover.muted.color}",
        activeColor: "{primary.500}",
      },
      separator: {
        borderColor: WHISPER_BORDER,
      },
    },
    message: {
      root: {
        borderRadius: "8px",
        borderWidth: "1px",
      },
      content: {
        padding: "0.75rem 1rem",
        gap: "0.75rem",
      },
      text: {
        fontSize: "0.875rem",
        fontWeight: "500",
      },
      icon: {
        size: "1rem",
      },
      closeButton: {
        width: "1.5rem",
        height: "1.5rem",
        borderRadius: "4px",
      },
      closeIcon: {
        size: "0.875rem",
      },
      info: {
        background: "{surface.0}",
        borderColor: "{primary.400}",
        color: "{primary.600}",
        shadow: CARD_SHADOW,
      },
      success: {
        background: "{surface.0}",
        borderColor: "{semanticAccent.teal}",
        color: "{semanticAccent.teal}",
        shadow: CARD_SHADOW,
      },
      warn: {
        background: "{surface.0}",
        borderColor: "{semanticAccent.orange}",
        color: "{semanticAccent.orange}",
        shadow: CARD_SHADOW,
      },
      error: {
        background: "{surface.0}",
        borderColor: "#dc2626",
        color: "#dc2626",
        shadow: CARD_SHADOW,
      },
      secondary: {
        background: "{surface.0}",
        borderColor: "{surface.300}",
        color: "{text.muted.color}",
      },
      contrast: {
        background: "{surface.800}",
        borderColor: "{surface.800}",
        color: "{surface.0}",
      },
    },
    toast: {
      root: {
        width: "24rem",
        borderRadius: "8px",
        borderWidth: "1px",
      },
      content: {
        padding: "0.75rem 1rem",
        gap: "0.75rem",
      },
      summary: {
        fontWeight: "600",
        fontSize: "0.875rem",
      },
      detail: {
        fontWeight: "400",
        fontSize: "0.875rem",
      },
      closeButton: {
        width: "1.5rem",
        height: "1.5rem",
        borderRadius: "4px",
      },
      closeIcon: {
        size: "0.875rem",
      },
      info: {
        background: "{surface.0}",
        borderColor: "{primary.400}",
        color: "{primary.600}",
        detailColor: "{primary.500}",
        shadow: CARD_SHADOW,
      },
      success: {
        background: "{surface.0}",
        borderColor: "{semanticAccent.teal}",
        color: "{semanticAccent.teal}",
        detailColor: "{semanticAccent.teal}",
        shadow: CARD_SHADOW,
      },
      warn: {
        background: "{surface.0}",
        borderColor: "{semanticAccent.orange}",
        color: "{semanticAccent.orange}",
        detailColor: "{semanticAccent.orange}",
        shadow: CARD_SHADOW,
      },
      error: {
        background: "{surface.0}",
        borderColor: "#dc2626",
        color: "#dc2626",
        detailColor: "#dc2626",
        shadow: CARD_SHADOW,
      },
      secondary: {
        background: "{surface.0}",
        borderColor: "{surface.300}",
        color: "{text.muted.color}",
        detailColor: "{text.muted.color}",
      },
      contrast: {
        background: "{surface.800}",
        borderColor: "{surface.800}",
        color: "{surface.0}",
        detailColor: "{surface.0}",
      },
    },
    splitter: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
      },
      gutter: {
        background: "{surface.100}",
      },
      handle: {
        size: "1.5rem",
        background: "{surface.300}",
        borderRadius: "4px",
      },
    },
    toggleswitch: {
      root: {
        borderRadius: "9999px",
        borderWidth: "1px",
        borderColor: "{surface.300}",
        hoverBorderColor: "{surface.400}",
        checkedBorderColor: "{primary.500}",
        checkedHoverBorderColor: "{primary.600}",
        background: "{surface.0}",
        hoverBackground: "{surface.50}",
        checkedBackground: "{primary.500}",
        checkedHoverBackground: "{primary.600}",
      },
      handle: {
        borderRadius: "100%",
        size: "0.875rem",
        background: "{surface.400}",
        checkedBackground: "#ffffff",
      },
    },
    selectbutton: {
      root: {
        borderRadius: "4px",
        invalidBorderColor: "{primary.400}",
      },
    },
    inputtext: {
      root: {
        background: "{surface.0}",
        borderColor: "#dddddd",
        hoverBorderColor: "{surface.300}",
        focusBorderColor: "{primary.400}",
        color: "rgba(0, 0, 0, 0.9)",
        placeholderColor: "{text.muted.color}",
        shadow: "none",
        borderRadius: "4px",
        paddingX: "0.75rem",
        paddingY: "0.5rem",
      },
    },
    tooltip: {
      root: {
        maxWidth: "16rem",
        gutter: "4px",
        shadow: CARD_SHADOW,
        padding: "0.375rem 0.5rem",
        borderRadius: "4px",
        background: "{surface.800}",
        color: "{surface.0}",
      },
    },
    divider: {
      root: {
        borderColor: WHISPER_BORDER,
      },
      content: {
        background: "{surface.0}",
        color: "{text.muted.color}",
      },
    },
    panel: {
      root: {
        background: "{surface.0}",
        borderColor: WHISPER_BORDER,
        color: "{text.color}",
        borderRadius: "12px",
      },
      header: {
        background: "transparent",
        color: "{text.color}",
        padding: "1.25rem",
        borderColor: WHISPER_BORDER,
        borderWidth: "0 0 1px 0",
        borderRadius: "12px 12px 0 0",
      },
      toggleableHeader: {
        padding: "1.25rem",
      },
      title: {
        fontWeight: "700",
      },
      content: {
        padding: "1.25rem",
      },
      footer: {
        padding: "0 1.25rem 1.25rem 1.25rem",
      },
    },
  },
});

/** Thought type → CSS color (Tailwind / PrimeVue surface) */
export const THOUGHT_TYPE_COLOR: Record<string, string> = {
  idea: "amber",
  insight: "violet",
};

/** Source type → Tailwind color base name (used by ContextCard left accent) */
export const SOURCE_TYPE_COLOR: Record<string, string> = {
  experience: "emerald",
  video: "rose",
  book: "teal",
  article: "teal",
  opinion: "purple",
  ai: "amber",
};
