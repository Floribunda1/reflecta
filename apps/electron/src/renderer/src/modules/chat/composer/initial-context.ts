export function shouldApplyInitialContext({
  initialContextKey,
  appliedInitialContextKey,
  editing,
  draft,
  fileCount,
}: {
  initialContextKey?: string;
  appliedInitialContextKey?: string;
  editing: boolean;
  draft: string;
  fileCount: number;
}) {
  return Boolean(
    initialContextKey &&
    appliedInitialContextKey !== initialContextKey &&
    !editing &&
    !draft.trim() &&
    fileCount === 0,
  );
}
