import type { MarkdownEditorSuggestion, MarkdownEditorSuggestionSource } from "../types";

export type WikiLinkSuggestionItem = MarkdownEditorSuggestion;
export type WikiLinkSuggestionSource = MarkdownEditorSuggestionSource;

export type WikiLinkSuggestionOptions = {
  source: WikiLinkSuggestionSource;
};
