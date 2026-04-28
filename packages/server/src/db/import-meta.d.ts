interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: {
      eager?: boolean;
      import?: string;
      query?: string | Record<string, string | boolean>;
    },
  ): Record<string, T>;
}
