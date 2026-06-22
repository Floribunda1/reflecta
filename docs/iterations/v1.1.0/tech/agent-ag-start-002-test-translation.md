# AG-START-002 Test Case 自动化翻译样例

> 日期：2026-06-22
>
> 来源：`apps/electron/e2e/agent/features/start-conversation.feature`
>
> 场景：`@AG-START-002 用户发送第一条消息后看到完整回复`

## Feature 场景

```gherkin
@P0 @happy_path @AG-START-002
场景: 用户发送第一条消息后看到完整回复
  假如用户已经进入 Agent 页面
  而且 Agent 当前可以正常回复
  当用户创建新对话
  而且用户输入 hello
  而且用户发送消息
  那么页面应该显示用户消息 hello
  而且页面应该显示 Agent 正在回复
  而且最终应该出现一条 Agent 回复正文
  而且输入框应该恢复可操作
  而且对话列表应该出现这条新对话
```

## 自动化测试

### E2E

文件：

```txt
apps/electron/e2e/agent/start-conversation.spec.ts
```

测试名：

```txt
@AG-START-002 sends first message and shows completed reply
```

测试准备：

```txt
启动 Electron E2E 临时数据目录
启用 fake Agent stream：先停在正在回复状态，再返回 FAKE_AGENT_REPLY
打开 Agent 页面
```

测试步骤：

```txt
点击新建对话
在输入框输入 hello
点击发送
```

断言：

```txt
页面显示 hello
在释放 fake stream 前，页面显示 Agent 正在回复
页面最终显示 FAKE_AGENT_REPLY
输入框恢复可输入
对话列表出现包含 hello 的新对话
```

不在 E2E 里测：

```txt
不检查 session 存储格式
不检查 JSONL / DB 具体字段
不检查 prompt
不检查 provider message shape
不检查 AI 自然语言质量
```

### Backend Integration

文件：

```txt
apps/electron/src/main/services/agent/runtime.integration.test.ts
```

测试名：

```txt
@AG-START-002 sendMessage stores user message and assistant reply
```

测试准备：

```txt
创建临时 DB / content storage root
创建 AgentRepository
创建 Agent runtime
注入 fake model：输入 hello，返回 FAKE_AGENT_REPLY
```

测试步骤：

```txt
调用 sendMessage({
  threadId: new thread,
  text: "hello"
})
等待 run 完成
读取 thread messages
读取 thread list
```

断言：

```txt
thread messages 第一条是 user message：hello
thread messages 第二条是 assistant message：FAKE_AGENT_REPLY
assistant message 是完成状态，不是 streaming
thread list 出现这个 thread
thread title / preview 包含 hello 或由 hello 生成的可读标题
```

不在 backend integration 里测：

```txt
不打开 Electron 窗口
不点击真实按钮
不验证 CSS / DOM
不打真实模型
```

### Renderer Test

文件：

```txt
apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx
apps/electron/src/renderer/src/modules/chat/composer/chat-composer.test.tsx
apps/electron/src/renderer/src/modules/chat/session/thread-sidebar.test.tsx
```

测试 1：

```txt
@AG-START-002 renders user message and completed assistant reply
```

输入 fixture：

```txt
messages:
  user: hello
  assistant: FAKE_AGENT_REPLY
isBusy: false
```

断言：

```txt
消息列表显示 hello
消息列表显示 FAKE_AGENT_REPLY
不显示正在回复状态
```

测试 2：

```txt
@AG-START-002 composer is enabled after reply completes
```

输入 fixture：

```txt
active thread has completed reply
isBusy: false
```

断言：

```txt
输入框可输入
发送按钮处于可用状态
```

测试 3：

```txt
@AG-START-002 thread list shows the new conversation
```

输入 fixture：

```txt
threads:
  title or preview: hello
```

断言：

```txt
对话列表显示包含 hello 的对话项
```

### Unit Test

这个 test case 不需要为了自己单独写 unit test。

只有新增纯逻辑时才补 unit test，例如：

```txt
thread title cleanup
message preview text
session entry -> view item
busy state -> composer disabled/enabled
```

## 最终落地结果

`@AG-START-002` 最少落成这些自动化测试：

```txt
1 个 E2E
1 个 backend integration
2 到 3 个 renderer tests
0 个专属 unit test
```

这样覆盖的是同一个用户场景：

```txt
用户发送 hello
看到自己的消息
看到 Agent 回复过程
看到最终回复
输入框恢复可用
对话列表出现新对话
```
