# v1.3.7 — Long Conversation Performance and Chat Navigation

> 日期：2026-07-31
>
> 状态：Implemented

## Changes

- Agent messages use dynamic-height virtualization so large histories keep only the visible window mounted.
- Conversation search and jump navigation locate messages through stable data indexes instead of requiring the full history DOM.
- Bottom anchoring and streaming follow behavior remain stable while message heights change.
- Jump navigation uses a quieter top-right rail with clearer progress, stronger contrast, and less idle visual noise.
- The Agent thread sidebar has more relaxed spacing and a wider default layout.
