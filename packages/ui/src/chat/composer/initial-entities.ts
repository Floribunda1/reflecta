export function shouldApplyInitialEntities({
  requestChanged,
  editing,
  text,
  attachmentCount,
}: {
  requestChanged: boolean;
  editing: boolean;
  text: string;
  attachmentCount: number;
}) {
  return requestChanged && !editing && !text.trim() && attachmentCount === 0;
}
