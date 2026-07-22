# v1.2.4 Agent Web Search 执行计划

> 日期：2026-07-22
>
> 状态：Draft
>
> 方案：直接集成 `pi-web-access`，固定 Exa，默认使用 `auto-summary`，不打开策展页面。

## 1. 结论

v1.2.4 不自行实现搜索 Provider、网页抽取器、PDF 解析、搜索结果存储或摘要工作流，直接复用 [Pi Web Access](https://github.com/nicobailon/pi-web-access) extension。

用户主路径固定为：

```text
用户提出需要外部信息的问题
  -> Agent 调用 web_search
  -> Pi Web Access 使用 Exa 搜索
  -> 当前 Agent 模型自动生成带来源摘要
  -> 摘要作为工具结果返回 Agent
  -> Agent 继续回答用户
```

稳定产品规则：

- 搜索过程不打开浏览器、弹窗或策展页面，不要求用户确认；
- 搜索 Provider 固定为 Exa，不提供 Provider 设置或切换 UI；
- 搜索 workflow 固定为 `auto-summary`，Agent 不能切换为 `summary-review` 或 `none`；
- 保留 Pi Web Access 的 `web_search`、`fetch_content` 和 `get_search_content` 三个工具；
- 删除 Reflecta 现有的 `web_fetch` 工具及其展示逻辑，不保留历史兼容；
- 搜索与摘要只进入对话，不自动创建 Context、Understanding 或 Connection；
- v1.2.4 不 fork Pi Web Access，不删除其内部未使用的 Provider 实现。

## 2. 目标与非目标

### 2.1 目标

- Agent 能主动搜索训练数据之外或可能变化的外部信息；
- 搜索完成后直接得到简洁、带可点击来源的摘要；
- Agent 能在需要证据时读取指定网页或取回之前暂存的完整搜索内容；
- 搜索结果不一次性占满模型上下文，沿用 Pi Web Access 的 session result storage；
- 开发阶段可使用 Exa 官方免费 MCP，配置 `EXA_API_KEY` 后自动使用正式 Exa API；
- extension 在 Electron 开发态、测试态和打包产物中都能稳定加载。

### 2.2 非目标

- 不做搜索结果人工勾选、摘要编辑或确认页面；
- 不做多 Provider、Provider fallback 或 Provider 抽象；
- 不自行实现搜索排序、网页正文抽取、GitHub clone、PDF、YouTube 或视频分析；
- 不新增 Exa 账号注册、付费、余额或 API Key 管理 UI；
- 不把网页摘要自动沉淀为用户的个人理解；
- 不为工具执行增加逐条搜索结果的流式 UI，第一版只显示开始、完成和失败状态。

## 3. 复用边界

Pi Web Access 已经提供本轮所需的深 Module：

```text
小 Interface
  web_search
  fetch_content
  get_search_content

深 Implementation
  Exa Search / Answer / MCP
  自动摘要
  网页正文抽取
  SSRF 与重定向防护
  PDF / GitHub / YouTube / 视频路由
  搜索结果暂存与恢复
  按 responseId 延迟读取正文
```

Reflecta 只负责三个接入点：

1. 在 Pi `ResourceLoader` 中显式加载 extension；
2. 在 Agent session 中启用三个工具，并固定运行策略；
3. 把工具生命周期翻译为现有 Reflecta 对话事件和中文状态。

不为单一 Exa 实现创建 Provider interface、factory 或 adapter。只有未来真正接入第二个 Provider 时才建立对应 seam。

## 4. 固定运行策略

### 4.1 App 隔离配置

Pi Web Access 默认读取 `PI_CODING_AGENT_DIR/web-search.json`。Reflecta 在 extension 加载前把它指向当前 app 的 `.pi-agent` 目录，并确保以下配置存在：

```json
{
  "provider": "exa",
  "workflow": "auto-summary",
  "webSearch": {
    "enabled": true
  }
}
```

配置写入规则：

- `provider` 和 `workflow` 是产品策略，每次启动都校准为固定值；
- 保留文件中的 `exaApiKey`、`ssrf` 等其他已知配置；
- 不把密钥写入日志、工具结果或 Reflecta event；
- 不读写用户全局的 `~/.pi/web-search.json`。

### 4.2 单 Provider 约束

Pi Web Access 的原始工具 schema 仍包含 `provider` 和 `workflow` 参数。为了不 fork 上游，Reflecta 增加一个最小 policy extension：

- `web_search.provider` 缺省或等于 `exa` 时允许；
- 显式请求其他 Provider 时阻止执行并返回稳定错误；
- `web_search.workflow` 缺省或等于 `auto-summary` 时允许；
- 显式请求 `summary-review` 或 `none` 时阻止执行；
- system prompt 同时要求 Agent 不传 `provider` 和 `workflow`，使用产品默认值。

这层 policy 是 Reflecta 的产品 seam；搜索、抓取和摘要 implementation 仍完全属于 Pi Web Access。

### 4.3 Exa 凭证与降级

- 没有 `EXA_API_KEY` 时，沿用 Pi Web Access 的 Exa MCP 路径，支持零配置体验；
- 存在 `EXA_API_KEY` 时，沿用其正式 Exa Search / Answer API 路径；
- 不允许失败后自动切换 OpenAI、Brave 或其他 Provider；
- 免费 MCP 返回 429 时明确告诉用户搜索暂时受限，不伪造搜索结果；
- 正式发布前根据真实使用频率决定是否由应用提供 Exa Key，本轮不提前建设密钥管理系统。

参考：

- [Exa MCP](https://exa.ai/docs/reference/exa-mcp)
- [Exa Search](https://exa.ai/docs/reference/search)
- [Exa Contents](https://exa.ai/docs/reference/contents-api-guide)
- [Exa Pricing](https://exa.ai/pricing?tab=api)

## 5. Task 0：Extension 加载技术闸门

先完成一个最小 integration spike，只验证 extension 能否原样进入 Reflecta runtime。

验证内容：

- 将 `pi-web-access` 固定为经过验证的 `0.13.0`，不使用浮动范围；
- 首选把 package 的 `index.ts` 解析为 `additionalExtensionPaths` 传给 Pi `ResourceLoader`；该路径失败时才改用动态 import 后的 default factory；
- 保持 `noExtensions: true`，只加载 `additionalExtensionPaths` 中明确指定的 extension，不开启全局 extension 自动发现；
- `resourceLoader.reload()` 后能发现 `web_search`、`fetch_content` 和 `get_search_content`；
- `createAgentSession({ tools })` 能激活三个工具；
- extension 的 TypeScript 源码和依赖能进入 Electron production bundle / unpack 产物；
- 开发态执行一次 Exa MCP 搜索，能返回摘要和来源；
- 打包态至少执行 extension 加载 smoke test，不发生模块解析或 ASAR 路径错误。

闸门失败时先解决加载方式，不开始自行重写 Pi Web Access。只有确认上游 package 无法在 Electron 中稳定运行，才单独记录替代方案并重新评审范围。

## 6. Task 1：接入 Pi Web Access 与策略配置

- 添加并锁定 `pi-web-access` dependency；
- 在 app-specific `.pi-agent` 目录初始化/校准 `web-search.json`；
- 在 `createPiResourceLoader` 中显式加载 Pi Web Access；
- 新增最小 `web_search` policy，固定 Exa 和 `auto-summary`；
- 把三个 extension tool name 加入 session active tools；
- 保持 `noExtensions: true`，继续禁止发现用户目录或项目目录中的任意 extension；
- 不加载 Pi Web Access 的 skills，不在 Reflecta 中接入其快捷键、widget 或 curator UI；
- 不修改 Pi Web Access 的源码。

验收：

- extension 只通过 Reflecta 明确注册的路径加载；
- Agent 不传额外参数即可完成 Exa 搜索和自动摘要；
- 任何非 Exa Provider 或非 `auto-summary` workflow 调用都被阻止；
- 搜索期间不会打开外部页面。

## 7. Task 2：替换现有 Web Fetch 与 Prompt 对齐

- 从 active read-only tools 中移除 `web_fetch`；
- 删除 `web_fetch` provider implementation、对应单元测试及 renderer 分支；
- 不迁移旧 session 中的 `web_fetch` tool event，也不保证其继续获得专用展示；
- system prompt 增加以下稳定规则：
  - 对新闻、当前状态、近期变更或模型不确定的外部事实优先使用 `web_search`；
  - 默认不传 `provider` 和 `workflow`；
  - 已知 URL 使用 `fetch_content`；
  - 需要搜索结果中的完整证据时使用 `get_search_content`；
  - 不把工具摘要当作用户已经形成的 Understanding；
- extension 工具输出只进入对话和 Pi Web Access 自己的 session storage，不收集进 Entity Catalog。

验收：

- Agent 面对当前信息问题会主动搜索，不从模型记忆猜测；
- Agent 面对用户提供的 URL 使用 `fetch_content`，不再调用 `web_fetch`；
- 搜索摘要包含来源链接；
- 后续追问可以按 `responseId` 读取完整结果；
- 读取搜索内容不会自动触发任何 Reflecta 写工具。

## 8. Task 3：对话展示

复用现有 tool activity UI，不新增搜索结果页面。

补充中文状态：

| Tool                 | 运行中           | 完成           |
| -------------------- | ---------------- | -------------- |
| `web_search`         | 正在搜索网页     | 已搜索网页     |
| `fetch_content`      | 正在读取来源     | 已读取来源     |
| `get_search_content` | 正在读取搜索内容 | 已读取搜索内容 |

展示规则：

- 运行中只显示简洁状态和查询摘要；
- 完成后正文仍由 Agent 消息呈现，不重复渲染一份独立搜索结果列表；
- 来源链接继续使用现有 Markdown renderer；
- 错误显示可理解的失败原因，隐藏 API Key、请求头和内部堆栈；
- 不接 curator message renderer、shortcut、widget 或外部浏览器 UI；
- 本轮不翻译 `tool_execution_update` 为新的持久化 event。

## 9. 数据、安全与产品边界

### 9.1 外部数据

- 搜索 query 会发送给 Exa；
- `fetch_content` 读取的 URL 及页面内容可能经过 Exa、Jina 或 Pi Web Access 内置的内容获取路径；
- Agent 在搜索 query 中不得主动拼入 Reflecta 的完整 Context、Understanding、私密日志或无关个人信息；
- 日志只记录 Provider、耗时、状态和稳定错误码，不记录密钥或完整正文。

### 9.2 网络安全

- 直接复用 Pi Web Access 的 SSRF、DNS 与 redirect validation，不以 Reflecta 现有的简单 hostname 校验替换；
- 禁止 localhost、private/reserved IP 和非 HTTP(S) URL；
- 保留请求取消与 timeout；
- 不传递本地浏览器 Cookie，不自动登录网站，不绕过 paywall。

### 9.3 个人理解边界

Web Search 提供外部信息和候选证据，不生成用户的个人理解：

- 工具摘要只留在对话；
- Agent 可以围绕摘要帮助用户对比、追问和判断；
- 只有用户明确表达并确认后，才允许通过现有写工具创建 Context 或 Understanding；
- URL、标题和自动摘要不能单独冒充 Context。

## 10. 测试策略

### 10.1 自动化测试

- Resource Loader：显式 extension 能加载且不会开启任意 extension discovery；
- Tool activation：三个 Pi Web Access 工具存在并激活，`web_fetch` 不再激活；
- Policy：默认参数和 `exa + auto-summary` 通过，其他 Provider/workflow 被阻止；
- Config：配置写入 app-specific `.pi-agent`，固定字段被校准，其他字段被保留；
- Host：三个 extension tool 的 start/end/error 能转换为现有 Reflecta tool event；
- Renderer：三个工具的中文状态和错误展示稳定，旧 `web_fetch` 专用展示已删除；
- Prompt：明确搜索、抓取、按需读取及不得自动沉淀的规则；
- Packaging：production build 能包含并解析 Pi Web Access extension。

常规 CI 不调用真实 Exa，不断言第三方搜索内容。网络成功路径通过手动 smoke test 验证。

### 10.2 手动 Smoke Test

1. 无 `EXA_API_KEY` 时询问当天新闻，确认走 Exa MCP 并返回带来源摘要；
2. 配置 `EXA_API_KEY` 后重复搜索，确认走正式 Exa API；
3. 请求限定近期或指定域名的信息，确认查询成功；
4. 要求读取一个已知 URL，确认调用 `fetch_content`；
5. 根据 `responseId` 追问某个来源细节，确认调用 `get_search_content`；
6. 搜索期间确认没有浏览器页面或人工确认 UI；
7. 模拟 429、timeout、取消和不可访问 URL，确认错误清楚且 Agent 不编造；
8. 重启同一对话，确认已暂存的搜索结果仍可按需读取；
9. 在 unpack/production build 中重复最小搜索流程。

## 11. 出口标准

- 用户询问当前外部信息时，Agent 能自动搜索并直接回答；
- 搜索固定使用 Exa，固定使用 `auto-summary`，全程不弹页面；
- 摘要包含可点击来源，Agent 可继续读取具体页面或暂存内容；
- 现有 `web_fetch` 及其历史兼容逻辑已删除；
- 没有 Provider UI、人工策展 UI、密钥管理 UI 或第二套搜索 implementation；
- extension 在开发态和 production build 中均可加载；
- Exa MCP/API 失败时返回明确错误，不自动切换其他 Provider、不从模型记忆伪装成搜索结果；
- 搜索不会自动写入 Context、Understanding 或 Connection；
- 定向测试、Electron node/web typecheck、lint、format check、production build 和 `git diff --check` 通过。

## 12. 提交边界

1. `docs(agent): plan exa web search extension`：保存本执行计划；
2. `feat(agent): load pi web access with exa policy`：dependency、加载闸门、隔离配置和固定策略；
3. `feat(agent): replace web fetch with pi web access`：工具启用、旧工具移除和 system prompt；
4. `feat(agent): surface web access tool activity`：对话状态与错误展示；
5. `test(agent): verify exa web search integration`：自动化回归、打包验证和完成记录。
