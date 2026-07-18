# v1.1.21

Patch release for Pi-native local tools and selective dangerous-command confirmation.

- Reflecta uses Pi's `DefaultResourceLoader` instead of maintaining a partial custom implementation.
- Pi's built-in `read`, `bash`, `edit`, and `write` tools replace Reflecta's duplicate local file and Bash tools.
- Ordinary Bash commands run without confirmation; commands matching the dangerous-command gate still require explicit approval.
- Reflecta knowledge mutations continue to require semantic approval before changing the user's knowledge graph.

See [Pi native tools and dangerous-command gate plan](pi-native-tools-and-permission-gate-plan.md).
