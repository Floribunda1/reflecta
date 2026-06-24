# Test Case 写作原则

这份文档用于逐渐积累项目里的 test case 写作原则。新增内容只记录已经明确提出并确认的原则，不自动扩展、不替换原意。

## 原则

### 先写 test case

Test case 应该先于 E2E、unit、integration 等后续测试实现方式被定义。

后续测试怎么落地，应该从 test case 派生；不要一开始就从 E2E 或 unit 的角度倒推 test case。

### 有组织地写 test case

Test case 不是 bullet list。

Test case 应该有组织地描述用户场景，而不是把零散检查点堆成列表。

### 按 QA 用户场景设计 test case

Test case 的设计入口是用户在产品里要完成的事情，不是代码模块、Agent runtime 状态机或自动化测试层级。

设计 test case 时，先拆用户场景族，再补场景覆盖：

```text
用户正常完成任务
用户遇到失败后继续使用
用户中断后恢复
用户在多个对象之间切换
用户带数据或上下文操作
用户查看和处理结果状态
```

这些覆盖维度可以体现在 scenario tag 里，例如 `@happy_path`、`@error`、`@recovery`、`@isolation`、`@context`，但 feature 文件的主结构仍然应该是用户场景。

### Test case 只维护 Feature 文件

新增或维护 test case 时，只产生 Gherkin / Cucumber feature 文件。

不要再创建一份并行的 `test-case.md`。

同一个模块可以维护多个 feature 文件。优先按用户场景族拆分文件，而不是按代码模块或自动化测试层级拆分。

Feature 文件名应该表达用户场景族，例如 `start-conversation.feature`、`history-recovery.feature`。

每个 test case 只需要表达这些信息：

```text
ID
目标
前置条件
步骤
期望结果
```

不要把后续流程信息写进 test case 本身。

### 用 Cucumber feature 表达 Test case

Test case 应该写成 Gherkin / Cucumber feature 文件。

对应关系：

```text
Feature  = 一组相关用户场景
Scenario = 一条 test case，场景名表达目标
Tag      = 稳定 ID
Given    = 前置条件
When     = 用户操作
Then     = 用户可观察的期望结果
```

Scenario 可以用 tag 作为稳定 ID，例如 `@AG-START-002`。

Feature 文件仍然只描述用户路径和产品表现，不写 unit、integration、E2E 等自动化测试分层。

### 只对用户场景负责

Test case 只需要对用户场景负责。

Test case 不对任何技术细节负责。它的出发点应该是终端用户实际看到的表现和产品预期，而不是当前技术实现。

### 期望结果写正确结果

Test case 应该保证能得到正确结果，而不是测试“不会得到某个错误结果”。

例如，打开 Agent 模块的 test case 应该描述用户应该看到的 Agent 页面状态；不要写成“打开 Agent 模块时不应该出现数据分析看板”。

### 不写 bug 症状回放

Test case 不应该记录某个历史 bug 的具体症状。

如果曾经因为某个 bug 导致页面空白，test case 也不要写成“打开这个页面不会空白”。

正确写法是回到稳定的产品行为：用户打开这个页面后，应该看到哪些核心内容、可执行哪些关键操作、当前场景如何判断通过。

Bug 回归可以由自动化测试或实现层测试覆盖，但 feature test case 只表达长期有效的用户场景和正确产品状态。

### Test case 必须可执行

Test case 交给不同的人执行时，应该能得到一致的理解和一致的通过 / 失败判断。

不要写只有作者自己知道含义的表达。比如“复杂回复按发生顺序显示”“显示在它发生的位置”这类说法，如果没有进一步定义，不同执行者可能会有不同理解。

需要写成执行者可以直接观察的状态、顺序、文字或操作结果。

### Test case 不绑定自动化测试实现

Test case 是面向最终用户路径和最终产品展示效果的验收用例。

它描述测试人员可以如何操作、观察什么结果、如何判断通过或失败。

不要在 test case 里讨论后续代码测试应该写成 unit、integration 还是 E2E。自动化测试分层是工程实现问题，不是 test case 写作原则。

### 不控制 AI 的具体输出

AI 的自然语言输出不可控，test case 不应该假设 AI 一定生成某一段固定文字或某个固定语义答案。

涉及 AI 回复时，test case 应该验证用户可见的产品状态，例如出现回复、回复完成、失败状态、停止状态、输入框恢复可用、对话状态保持一致。

只有当内容来自已经存在的 seed、fixture 或预置对话状态时，才可以把具体文字写进 test case。

### 测试数据必须可获得

Test case 里的具体数据必须在测试执行环境中真实存在。

如果写出具体名称，这个名称必须来自 seed 数据、数据库预置数据或 fixture。不要凭空写一个看起来像真实数据的名称。

如果具体值不重要，就用大写代指，并在执行前从 seed 或 fixture 绑定，例如 `B_USER_MESSAGE`、`CANDIDATE_TITLE`、`ATTACHMENT_FILE`。

不要在 test case 里引入项目没有的产品概念。
