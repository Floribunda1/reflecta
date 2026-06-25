# v1.1.11

Patch release for Agent chat title generation.

- Do not persist generic generated titles such as `新对话` over non-empty conversations.
- Let empty title model output fall back to the first user message instead of overwriting the thread.
- Raise the title generation output budget and avoid explicit reasoning for the title-only request.
- Log title generation diagnostics for model output, prompt size, and final persistence decisions.
