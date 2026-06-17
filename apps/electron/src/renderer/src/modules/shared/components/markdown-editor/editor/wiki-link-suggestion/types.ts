export type WikiLinkSuggestionItem = {
  id: string;
  title: string;
  preview?: string;
  markdown: string;
};

export type WikiLinkSuggestionSource = (
  query: string,
  signal: AbortSignal,
) => Promise<WikiLinkSuggestionItem[]>;

export type WikiLinkSuggestionOptions = {
  source: WikiLinkSuggestionSource;
};
