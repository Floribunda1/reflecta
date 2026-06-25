# v1.1.9

Patch release for keeping application-owned artifacts out of user content storage.

- Store retrieval index data under App Config Dir instead of Content Storage Root.
- Store diagnostic logs under App Config Dir instead of Content Storage Root.
- Keep Content Storage Root focused on `reflecta.db`, `Sessions/`, and `assets/`.
