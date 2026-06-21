# ADR 0002: Store AI providers as provider-owned model lists

Reflecta keeps provider names, endpoints, and default models in a built-in provider catalog, while
user AI configuration stores only API keys, enabled model IDs, and the active Agent model selection.
This intentionally replaces the old single-provider and manually-entered endpoint shape because
model choice is now a product concept shared by settings and Agent chat.
