# v1.1.8

Patch release for removing the packaged app Keychain prompt.

- Store app configuration secrets as plain JSON instead of Electron safeStorage values.
- Remove the old `safe:v1` config encryption path and related test mocks.
- Keep diagnostic log redaction based on secret field names.
