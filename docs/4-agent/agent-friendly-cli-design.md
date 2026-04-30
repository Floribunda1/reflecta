# Agent-Friendly CLI 设计原则

> 面向 Agent 设计的命令行工具接口规范。

---

## 1. 定义

**Agent-Friendly CLI** 指专供 AI Agent（而非人类用户）通过 Shell 调用的命令行工具。其设计目标是让 Agent 能够**可靠地发现、调用、解析** CLI 能力，同时**最小化 Token 消耗**。

与人类 CLI 不同，Agent-Friendly CLI：

- 不需要考虑 TTY 检测、颜色、进度条、交互式提示。
- 不需要为人类阅读优化排版或提供文本摘要。
- 假设调用方是程序，能够处理结构化数据，但无法处理歧义或隐式约定。

在知识库、项目管理、图谱探索这类领域中，Agent-Friendly CLI 不应只暴露底层 CRUD。Agent 经常需要先读取一组相关对象再综合推理，因此 CLI 还应提供面向工作流的批量读取接口，例如 `category inspect`、`graph neighborhood`、`project snapshot` 这类命令。

---

## 2. 核心原则

### 2.1 Token 最小化（首要原则）

Agent 的上下文窗口有限，CLI 的输出直接进入 LLM 的 prompt。每一字节都应是有效数据。

- **禁止包装层**：成功时直接输出裸数据，不要套 `{ok, data}` envelope。
- **列表优先 JSONL**：返回多条记录时，默认使用 JSON Lines（每行一个裸 JSON 对象），比 JSON 数组更省 token（省掉 `[]` 和行间逗号）。
- **图谱/快照允许 JSON object**：当返回值本身是多种对象的聚合，例如 `{nodes, edges, contexts, page}`，应使用裸 JSON object。不要为了 JSONL 而拆散一个语义完整的分析上下文。
- **空即成功**：无返回值的变更操作（如删除）直接输出空字符串，由 exit code `0` 代表成功。

### 2.2 零歧义

Agent 必须能 100% 区分「成功拿到数据」和「执行出错」。

- **成功 → stdout**：直接输出业务数据（裸 JSON 对象、JSON 数组、JSONL 行、或空）。
- **失败 → stderr**：统一输出 JSON 错误对象，结构固定为 `{code, message, details?}`。
- **Exit code 必须语义化**：`0` 成功，`1` 业务错误，`2` 用法错误，`3` 需要确认（变更操作缺确认标志）。

### 2.3 可发现（Discoverable）

Agent 不应硬编码可用命令列表，而应通过 `--help` 或专用 meta 命令在运行时探索。

- **命令层级**：使用 `名词 动词` 结构（如 `resource create`、`resource list`），而非扁平的 RPC 风格命名（如 `create_resource`）。
- **`--help` 输出 JSON**：由于调用方是 Agent，`--help` 永远输出结构化 JSON，不提供人类文本排版。
- 每层 `--help` 只暴露当前层级的子命令或参数签名，Agent 按需下探。
- **推荐提供 meta API**：复杂 CLI 可以提供 `meta actions` 和 `meta schema <command>`，输出比 `--help` 更稳定、更完整的机器可读 schema。`--help` 适合逐层探索，`meta schema` 适合让 Agent 精确获知参数、输出 shape、mutation 标记和示例。

### 2.4 默认安全

变更操作（mutation）默认禁止执行，防止 Agent 在推理过程中误触副作用。

- 所有写入操作必须显式传入确认标志（如 `--yes`）。
- 缺少确认时，CLI 不执行任何副作用，直接返回错误码 `CONFIRMATION_REQUIRED`（exit code `3`）。
- 不提供 dry-run：Agent 可以通过「先查询相关数据 → 再执行变更」自行模拟预览，CLI 保持最小表面。

### 2.5 无交互

CLI 在任何情况下都不应挂起等待用户输入。

- 禁止交互式提示、密码输入框、确认对话框。
- 所有输入必须通过命令行参数、选项或 `--stdin` 传递。
- 超时和重试由调用方（Agent）控制，CLI 本身不实现智能重试。

---

## 3. 命令结构设计

### 3.1 名词 + 动词

```
<bin> <noun> <verb> [positional-args] [flags]
```

示例：

```bash
mycli user create --name "Alice" --role admin
mycli user get <id>
mycli user list --limit 10
mycli user delete <id>
```

**为什么不用扁平 RPC 风格？**

- `create_user`、`list_users`、`delete_user` 把所有动词摊平在同一命名空间，Agent 难以归纳模式。
- `user create`、`user list` 与主流 SDK / ORM 一致（`user.create()`、`user.list()`），Agent 的泛化能力可以迁移。
- Tab 补全友好：`mycli user <tab>` 只会提示 user 相关操作，降低每层认知负荷。

### 3.2 位置参数 vs 选项

| 类型           | 用途                                        | 示例                         |
| -------------- | ------------------------------------------- | ---------------------------- |
| **Positional** | 主键、查询词、源/目标 ID 等几乎每次必传的值 | `get <id>`、`search <query>` |
| **Flag**       | 可选配置、过滤条件、开关                    | `--limit 20`、`--type idea`  |

原则：位置参数只用于「这个命令最本质的输入」，其余全部用选项。避免超过 2 个位置参数。

### 3.3 JSON 逃生舱

当数据结构确实需要嵌套（如批量更新、复杂排序规则）时，保留 `--json` 和 `--stdin` 作为 fallback：

```bash
mycli batch update --json '[{"id":"a","sortOrder":0}]'
echo '[...]' | mycli batch update --stdin
```

95% 的日常调用应无需手写 JSON。

### 3.4 原子 API 与工作流 API

面向 Agent 的 CLI 应区分两类命令：

- **原子 API**：围绕单个资源读写，如 `thought get`、`context create`、`task update`。
- **工作流 API**：一次读取 Agent 推理所需的局部上下文，如 `category inspect`、`graph neighborhood`、`project snapshot`。

原子 API 保证能力可组合；工作流 API 避免 Agent 用 N+1 次调用自己拼装上下文。

示例：

```bash
# 原子读取
reflecta thought get th_123

# 工作流读取：一次返回分类、节点、边、来源材料和分页信息
reflecta category inspect cat_123 --include-descendants --include-contexts --include-connections --format json
```

设计原则：

- 当 Agent 的常见任务天然需要一组相关对象，不要只提供 `list` + `get`。
- 工作流 API 仍然应该是只读命令，写入继续走原子 mutation。
- 工作流 API 必须提供 `--limit`、`--offset` 或 `--cursor`，以及 `--include-*` 控制输出体积。

---

## 4. 输入设计

### 4.1 全局选项

每个命令都应支持以下全局选项：

```
--format <fmt>      json | jsonl  （默认：jsonl，见下文）
--yes               自动确认变更操作
--quiet             静默模式：只输出错误到 stderr
--verbose           调试日志输出到 stderr（不影响 stdout 数据结构）
```

### 4.2 可重复选项 → 数组

同一 flag 出现多次自动收集为数组，无需 Agent 构造 JSON 数组字符串：

```bash
mycli resource create --tag foo --tag bar --tag baz
# 等价于 { tags: ["foo", "bar", "baz"] }
```

---

## 5. 输出设计

### 5.1 成功时的 stdout

| 场景                          | `--format=json`                       | `--format=jsonl`     |
| ----------------------------- | ------------------------------------- | -------------------- |
| 单条查询                      | 裸 JSON 对象，或 `null`               | 不适用               |
| 列表查询                      | JSON 数组 `[{...},{...}]`             | 每行一个裸 JSON 对象 |
| 工作流快照 / 图谱 inspect     | 裸 JSON 对象，如 `{nodes,edges,page}` | 不适用               |
| 变更（create / update）       | 裸 JSON 对象（返回完整新对象）        | 不适用               |
| 变更（delete / 无副作用操作） | 空字符串（仅 exit 0）                 | 不适用               |

**列表默认格式建议**：默认 `jsonl`。对 Agent 来说，逐行读取比等待数组闭合括号更自然，且更省 token。

**嵌套结果格式建议**：当命令返回的是一个语义完整的分析上下文，而不是同质列表，默认使用 `json`。例如图谱邻域、分类快照、项目状态快照。Agent 调用这类命令时通常需要整体解析，不应拆成多条 JSONL。

### 5.2 失败时的 stderr

所有错误统一向 stderr 输出以下结构：

```json
{
  "code": "NOT_FOUND",
  "message": "Resource 'xxx' does not exist.",
  "details": { "resourceId": "xxx" }
}
```

Agent 的标准处理流程：

1. 检查 exit code；非 0 即失败。
2. 从 stderr 读取 JSON，解析 `code` 和 `message`。
3. stdout 在失败时应被忽略。

### 5.3 为什么不用 Envelope？

对比两种方案：

| 场景          | Envelope 方案                    | 裸数据方案（推荐） |
| ------------- | -------------------------------- | ------------------ |
| `get` 成功    | `{"ok":true,"data":{"id":"r1"}}` | `{"id":"r1"}`      |
| `delete` 成功 | `{"ok":true,"data":null}`        | `（空）`           |
| 列表 20 条    | 外层多 ~40 字节 + meta           | 零额外包装         |

Agent 天然知道它调用了什么命令，因此不需要 envelope 来「告知返回的是哪种数据」。exit code 已足以区分成功/失败。

---

## 6. 错误码与退出码

### 6.1 退出码规范

| 退出码 | 含义                    | Agent 应如何处理                           |
| ------ | ----------------------- | ------------------------------------------ |
| `0`    | 成功                    | 解析 stdout                                |
| `1`    | 业务错误                | 解析 stderr JSON，根据 `code` 分支         |
| `2`    | CLI 解析错误 / 用法错误 | 检查命令拼写和参数，或重新调用 `--help`    |
| `3`    | 需要确认                | 变更操作缺少 `--yes`，需重新调用并追加确认 |

### 6.2 错误码目录

建议每个 CLI 维护以下最小错误码集合：

| 错误码                              | 触发场景                             |
| ----------------------------------- | ------------------------------------ |
| `VALIDATION_ERROR`                  | 参数缺失或非法（含 `details.field`） |
| `NOT_FOUND`                         | 资源 ID 不存在                       |
| `CONFIRMATION_REQUIRED`             | 变更操作缺少 `--yes`                 |
| `DB_NOT_FOUND` / `CONFIG_NOT_FOUND` | 依赖文件缺失                         |
| `INTERNAL_ERROR`                    | 未捕获异常                           |

---

## 7. 自省（`--help`）

由于调用方是 Agent，`--help` 永远输出 JSON，不提供人类文本。

### 7.1 顶层帮助

```bash
$ mycli --help
→ {"commands":[{"name":"user","description":"Manage users"},{"name":"project","description":"Manage projects"}]}
```

### 7.2 子命令帮助

```bash
$ mycli user create --help
→ {"command":"mycli user create","description":"Create a new user.","mutates":true,"args":[{"name":"--name","type":"string","required":true},{"name":"--role","type":"enum","required":false,"values":["admin","member"]}]}
```

Agent 可直接消费此 JSON，无需解析自由文本。

### 7.3 Meta Schema

对于命令数量较多、输出 shape 较复杂的 CLI，建议提供专用 meta 命令：

```bash
$ mycli meta actions
→ [{"command":"task list","mutates":false,"schemaCommand":"mycli meta schema task.list"}]
```

```bash
$ mycli meta schema task.list
→ {"command":"task list","mutates":false,"required":[],"options":{"status":"string","limit":"number"},"output":"TaskSummary[]","examples":["mycli task list --status pending --limit 10"]}
```

`--help` 和 `meta schema` 的分工：

- `--help`：逐层探索命令树，适合 Agent 不知道有哪些 namespace 时使用。
- `meta schema`：获取单个命令的稳定机器契约，适合执行前确认 required args、options、output shape 和 mutation 风险。

---

## 8. 安全机制

### 8.1 变更确认

所有写入操作必须显式确认：

```bash
$ mycli user delete u-123
→ stderr: {"code":"CONFIRMATION_REQUIRED","message":"Pass --yes to execute.","details":{"command":"user delete","id":"u-123"}}
→ exit code: 3
```

```bash
$ mycli user delete u-123 --yes
→ （空，exit 0）
```

### 8.2 不提供 dry-run

- 增加实现复杂度（需要在每个 mutation handler 中维护「只读事务 + 构造预览对象」的分支）。
- Agent 可以通过「先查询 → 再执行」自行评估影响。
- CLI 保持最小表面，不实现 dry-run。

---

## 9. 完整示例（Agent 视角）

```bash
# 探索能力
$ mycli --help
→ {"commands":[{"name":"task","description":"Manage tasks"}]}

$ mycli task create --help
→ {"command":"mycli task create","mutates":true,"args":[...]}

# 查询列表（默认 jsonl）
$ mycli task list --status pending --limit 5
→ {"id":"t1","title":"Fix bug"}
→ {"id":"t2","title":"Update docs"}

# 查询单条
$ mycli task get t1
→ {"id":"t1","title":"Fix bug","status":"pending"}

# 创建
$ mycli task create --title "New feature" --yes
→ {"id":"t3","title":"New feature","status":"pending"}

# 错误
$ mycli task get missing-id
→ stderr: {"code":"NOT_FOUND","message":"Task 'missing-id' not found."}
→ exit code: 1
```

---

## 10. 检查清单

设计或评审一个 Agent-Friendly CLI 时，确认以下每项：

- [ ] 命令结构是 `名词 动词`，而非扁平 RPC 命名。
- [ ] 常见调用无需手写 JSON，参数通过位置参数和选项传递。
- [ ] 常见工作流有批量读取 API，不需要 Agent 通过 N+1 次 `get` 拼上下文。
- [ ] 成功时 stdout 直接输出裸数据，不套 envelope。
- [ ] 失败时 stderr 输出统一 JSON 错误对象 `{code, message, details?}`。
- [ ] 列表默认使用 JSONL 格式。
- [ ] 图谱、快照、inspect 类嵌套结果使用裸 JSON object，并提供分页和 `--include-*` 控制体积。
- [ ] Exit code 语义化：`0/1/2/3` 分工明确。
- [ ] 变更操作需要 `--yes` 确认，缺少时返回固定错误码 `CONFIRMATION_REQUIRED`（exit 3）。
- [ ] `--help` 输出 JSON，而非人类文本。
- [ ] 复杂 CLI 提供 `meta actions` / `meta schema`，让 Agent 能读取稳定命令契约。
- [ ] CLI 在任何情况下不挂起等待交互输入。
- [ ] 不提供 dry-run，由 Agent 通过「先查后改」自行模拟。
