# v1.3.5 — Agent Activity and Entity References

> 日期：2026-07-31
>
> 状态：Implemented

## Changes

- Agent reasoning, tool activity, and proposals use one receipt hierarchy for both single and grouped execution.
- Completed proposal receipts keep approval and execution states while hiding redundant internal result metadata.
- Agent citations use `[[u:<id>]]`, `[[c:<id>]]`, and `[[d:<id>]]`.
- Understanding bodies only reference other Understandings through `[[u:<id>]]`; Context content does not support entity references.
- `v1.3.5.sql` migrates legacy `[[title#understanding-id]]` links in Understanding bodies without rewriting Context content.
