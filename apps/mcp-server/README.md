# @reflecta/mcp-server

Reflecta MCP Server — expose your knowledge base to AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Tools

| Tool                   | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `search_thoughts`      | Full-text search over thoughts (SQLite FTS)            |
| `get_thought`          | Get a single thought by ID with full relations         |
| `list_categories`      | List all categories                                    |
| `list_recent_thoughts` | List recently updated thoughts                         |
| `search_contexts`      | Full-text search over context source names and content |

## Database path resolution

The server tries the following in order:

1. **`REFLECTA_DB_PATH`** environment variable
2. **`reflecta-config.json`** (`storagePath` field) in the platform-specific user data directory
3. Platform default:
   - **macOS**: `~/Library/Application Support/reflecta/reflecta.db`
   - **Windows**: `%APPDATA%/reflecta/reflecta.db`
   - **Linux**: `~/.local/share/reflecta/reflecta.db`

## Usage

### Build

```bash
bun run build
```

### Run

```bash
node ./dist/index.mjs
```

Or with a custom database path:

```bash
REFLECTA_DB_PATH=/path/to/reflecta.db node ./dist/index.mjs
```

### Claude Desktop / Cline / Other MCP clients

Add to your MCP client config (e.g. `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "reflecta": {
      "command": "node",
      "args": ["/absolute/path/to/reflecta/apps/mcp-server/dist/index.mjs"],
      "env": {
        "REFLECTA_DB_PATH": "/path/to/reflecta.db"
      }
    }
  }
}
```

Or if installed globally / via `bun link`:

```json
{
  "mcpServers": {
    "reflecta": {
      "command": "reflecta-mcp-server",
      "env": {
        "REFLECTA_DB_PATH": "/path/to/reflecta.db"
      }
    }
  }
}
```
