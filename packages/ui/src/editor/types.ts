export type MarkdownEditorSuggestion = {
  id: string;
  type?: "understanding" | "context" | "domain";
  label: string;
  preview?: string;
  markdown: string;
};

export type MarkdownEditorSuggestionSource = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly MarkdownEditorSuggestion[]>;

export type MarkdownAssetUploadResult = {
  url: string;
  alt?: string;
};

export type MarkdownAssetUploader = (
  file: File,
  signal: AbortSignal,
) => Promise<MarkdownAssetUploadResult>;
