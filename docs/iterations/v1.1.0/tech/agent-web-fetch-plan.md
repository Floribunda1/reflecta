# v1.1.0 Agent Web Fetch 计划

> 日期：2026-06-24
>
> 状态：Draft
>
> 目标：给 Pi Agent 增加一个最小可用的网页读取工具，让用户粘贴文章、Twitter/X、GitHub、文档等 URL 后，Agent 能读取页面内容并作为 Context 讨论。第一版不做 Web Search，不读取本地浏览器 Cookie，不接多个 provider。

## 1. 结论

v1.1.0 先做 Web Fetch，不做 Web Search。

Reflecta 现在更需要的是：

```txt
user pasted URL
  -> read page as markdown
  -> agent discusses it with the user
  -> user decides whether and how it becomes Context / Understanding
```

不是：

```txt
agent searches the web
  -> finds many external sources
  -> synthesizes an answer
```

原因：

- Reflecta 的核心是沉淀用户的个人理解，不是替用户扩展资料收集面。
- 用户粘贴的 URL 本身就是一个具体 Context 入口。
- Web Search 会引入 provider 选择、结果排序、来源质量和自动资料扩张问题，第一版不需要。
- Web Fetch 足够支撑“把这条 tweet / 这篇文章 / 这个 issue 拿来聊”的主路径。

第一版默认 provider 选 `curl.md`：

```txt
https://curl.md/{url}
```

它已经有 Pi 社区插件形态，工具名接近 `read_web_page`，并且适合“URL 转 markdown”的最小需求。

不直接接 `pi-web-access`。它覆盖 web search、URL fetch、GitHub clone、PDF、YouTube、多个 search provider 和 Pi extension UI 行为，范围太宽。Reflecta 只需要其中的一个窄能力：读取用户给定 URL。

## 2. 社区方案校准

### 2.1 Web Fetch 是独立能力

OpenCode / Qwen Code 这类 agent 工具一般区分：

```txt
web_search = 发现网页
web_fetch = 读取指定网页
```

Reflecta 第一版只需要后者。

参考：

- [OpenCode tools](https://opencode.ai/docs/tools/)
- [Qwen Code web_fetch](https://qwenlm.github.io/qwen-code-docs/en/developers/tools/web-fetch/)

### 2.2 URL-to-Markdown 服务是最短路径

社区里常见的“贴链接直接读”不是自己维护完整浏览器集群，而是用 URL-to-Markdown 服务：

- `curl.md`
- Jina Reader `r.jina.ai`
- Firecrawl scrape

当前选择：

```txt
default = curl.md
```

理由：

- 有 Pi 插件文档，和当前 Pi runtime 心智更近。
- API 形态极简单：URL 前面加 `https://curl.md/`。
- 匿名额度足够第一版验证。
- 对公开 Twitter/X 链接能读出 tweet / profile 的主要内容。
- 失败结果也是 markdown/text，容易展示给 Agent 判断。

不选：

- Jina Reader：公开网页读取好用，但当前匿名访问 X 可能被 451 临时封锁。
- Firecrawl keyless：官方提供无 key 额度，但实际请求可能因为 IP 风控被拒，需要 key 才稳定。
- SearXNG / Exa / Brave：这是 search provider，不解决“读取用户给定 URL”的第一需求。

参考：

- [curl.md Pi plugin](https://curl.md/docs/plugins/pi)
- [curl.md API](https://curl.md/docs/guide/api)
- [Jina Reader](https://jina.ai/reader/)
- [Firecrawl](https://www.firecrawl.dev/)

### 2.3 登录态网页以后走 Browser Capture

知乎、私有页面、需要登录的 Twitter/X 内容，不应该第一版靠读取本地浏览器 Cookie 解决。

更合理的后续能力是：

```txt
browser_capture
  -> user clicks extension/bookmarklet in their logged-in browser
  -> Reflecta receives current URL + title + selected text + rendered page text
  -> agent uses captured content
```

这和用户心智一致：用户主动把当前页面发给 Reflecta。

不做 Cookie 读取：

- Chrome / Arc / Safari 的 cookie 存储和加密机制不同。
- macOS Keychain 权限会让实现和分发复杂化。
- 直接把 cookie 交给 agent 或 fetch 层有隐私风险。
- 对 JS-heavy 页面来说，cookie 不等于可读内容；读取渲染后的 DOM 更可靠。

第一版只在 `web_fetch` 失败时返回明确提示：

```txt
This page looks blocked or login-gated. Open it in your browser and send the page to Reflecta when Browser Capture is available.
```

## 3. 目标 Tool Contract

工具名：

```txt
web_fetch
```

也可以在 UI 文案里叫：

```txt
read_web_page
```

但 Pi tool contract 使用一个名字，避免同时出现两个入口。

输入：

```ts
type WebFetchInput = {
  url: string;
};
```

输出：

```ts
type WebFetchOutput = {
  url: string;
  finalUrl?: string;
  title?: string;
  markdown: string;
  provider: "curl.md";
  truncated: boolean;
  blocked?: boolean;
  error?: string;
};
```

语义：

- `url` 必须是用户提供或对话中明确出现的 URL。
- Agent 不应该用 `web_fetch` 自己枚举搜索结果。
- 成功时返回 markdown。
- 内容过长时截断，并设置 `truncated: true`。
- 页面被登录墙、风控或 provider 拒绝时返回 `blocked: true`，不要假装读到了正文。
- `web_fetch` 只读网页，不写入 Reflecta 数据。
- 是否把网页内容沉淀成 Context，必须由用户确认或通过现有写工具 approval。

## 4. 安全边界

虽然第一版走 `curl.md`，仍然需要做本地输入校验。

必须做：

- 只允许 `http:` / `https:`。
- 拒绝空 URL、相对 URL、`file:`、`data:`、`javascript:`。
- 拒绝明显的 localhost / private network URL。
- 设置请求超时。
- 设置最大返回字符数。
- 不把任何 cookie、token、Authorization header 传给 provider。

不做：

- 读取本地浏览器 Cookie。
- 自动登录第三方网站。
- 自动绕过 paywall / login wall。
- 多 provider fallback。
- Web Search。

## 5. 集成点

当前 Pi read-only tools 在：

```txt
apps/electron/src/main/services/agent/pi-readonly-tools.ts
```

需要新增：

```txt
PI_READ_ONLY_TOOL_NAMES += "web_fetch"
createPiReadOnlyTools() += defineTool({ name: "web_fetch", ... })
```

建议把 provider 调用放在同目录的小模块里：

```txt
apps/electron/src/main/services/agent/web-fetch.ts
```

不要抽 provider interface。第一版只有 `curl.md`，一个函数够了：

```ts
async function fetchWebPage(url: string): Promise<WebFetchOutput>;
```

`pi-agent-host.ts` 不需要特殊逻辑。它已经把 `createPiReadOnlyTools()` 和 `PI_READ_ONLY_TOOL_NAMES` 注入 Pi session。

system prompt 需要补一句工具使用规则：

```txt
When the user provides a URL and asks about its content, use web_fetch before answering from memory.
```

## 6. Phase Plan

### Phase 1：最小 Web Fetch 工具

目标：用户粘贴公开 URL 后，Agent 能读取 markdown。

改动：

- 新增 `web_fetch` read-only Pi tool。
- 新增 `fetchWebPage(url)`。
- 使用 `curl.md` 作为唯一 provider。
- 加 URL 校验、超时、截断。
- 更新 Pi system prompt。
- 更新 read-only tool 列表测试。

验收：

- 粘贴公开文章 URL，Agent 会先调用 `web_fetch`。
- 粘贴公开 Twitter/X status URL，Agent 能拿到 tweet 主要内容或明确 blocked。
- 粘贴知乎风控 URL，Agent 明确说明页面不可读，不编造正文。
- 粘贴 `file:///etc/passwd` / `http://localhost:...` 会被拒绝。

### Phase 2：Context 沉淀路径对齐

目标：Web Fetch 内容能自然进入 Reflecta 的 Context 工作流。

改动：

- Agent 读取页面后，只能提出 Context 候选表达。
- 写入仍然走现有 `context_create` approval。
- Context medium 对网页默认使用 `article` 或 `opinion`，由用户语义决定，不新增 `webpage` 类型。

验收：

- Agent 不会把网页总结自动写成 Understanding。
- Agent 会先帮助用户咀嚼、对比、追问，再建议是否沉淀。
- 写入前 UI 仍展示 approval。

### Phase 3：Browser Capture 预留，不进入第一版实现

目标：为登录态/动态页面保留清晰后续路径。

第一版只写文档和错误提示，不实现扩展。

后续再做：

- Chrome / Arc extension 或 bookmarklet。
- 当前页 title / url / selected text / rendered DOM text 发送到 Reflecta。
- Reflecta 把 captured page 当成可读取 Context source。

不做：

- 读取 Chrome / Safari cookie database。
- 在 Reflecta 内嵌浏览器里让用户重新登录。

## 7. 测试计划

只测稳定规则，不测第三方服务内容。

单元测试：

- URL protocol 校验。
- private / localhost URL 拒绝。
- curl.md URL 拼接。
- 超长 markdown 截断。
- provider 403 / 451 / 5xx 转成 `blocked` 或 `error`。

Pi tool 测试：

- `PI_READ_ONLY_TOOL_NAMES` 包含 `web_fetch`。
- `createPiReadOnlyTools()` 暴露同名工具。
- `web_fetch` execute 调用 `fetchWebPage()` seam。

不做：

- 用真实 Twitter/X 或知乎链接作为 CI 断言。
- snapshot 测第三方返回 markdown。
- Playwright 浏览器测试。

## 8. 出口标准

v1.1.0 这一项完成时，应该满足：

- Agent 可以读取用户粘贴的公开网页 URL。
- Agent 知道什么时候必须先 fetch 再回答。
- 公开网页失败时返回清楚的 blocked/error，而不是幻觉。
- 没有新增 API key 配置。
- 没有 provider 选择 UI。
- 没有读取用户浏览器 Cookie。
- 没有引入 Web Search。
