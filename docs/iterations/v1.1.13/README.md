# v1.1.13

Patch release for Agent chat runtime recovery and composer input fixes.

- Use actual Agent runtime usage for the context meter.
- Restore active Agent stream snapshots so reloads can recover in-flight replies.
- Keep Enter behavior focused: send messages when appropriate, and select context mentions while the menu is open.
