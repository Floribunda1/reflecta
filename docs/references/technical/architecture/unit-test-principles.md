# Unit Test 写作原则

这份文档用于定义项目里的 Unit Test 应该怎么被驱动。

Unit Test 不是从代码结构里长出来的，也不是从 feature 文件逐行翻译出来的。Unit Test 只在一个地方出现：用户场景背后有一条稳定规则，而这条规则用 E2E 测太贵、太慢、太脆，或者组合太多。

## 核心判断

E2E 由用户场景驱动。

Unit Test 由稳定规则驱动。

写 Unit Test 前先问三个问题：

```text
这是不是产品行为的一部分？
它能不能用稳定输入和稳定输出说明白？
它是不是比放进 E2E 更便宜？
```

三个答案都是 yes，才写 Unit Test。

如果答案不是 yes，就不要写。没有必要为了每个函数、组件、hook 或分支补一个测试。

## Unit Test 应该测什么

### 纯业务规则

规则输入清楚，输出清楚，不需要真实 UI、真实浏览器或真实进程。

例如：

```text
threads -> groupedThreads
thoughts + selectedRefs + query -> context candidates
session events -> restored session state
profile name + env -> content storage path
```

这类测试应该保留，因为它们便宜、稳定，而且能覆盖 E2E 很难穷举的组合。

### 协议到产品模型的翻译

当后端、runtime、AI SDK 或 Agent 返回的是事件、parts、tool result 等结构时，系统通常需要把它们翻译成项目内部稳定模型。

例如：

```text
agent runtime parts -> message view model
provider stream chunk -> normalized run event
tool call + tool result -> persisted session event
storage record -> domain object
```

这类逻辑适合 Unit Test。它不是测框架或 IO，而是测产品语义有没有被正确翻译。

### 多组合边界

E2E 应该跑主路径，不应该穷举所有组合。

如果一个规则有很多输入组合，但每个组合都能用小数据表达，就用 Unit Test 补。

例如：

```text
空 query 时不搜索 context
已选择的 context 不再出现在候选项里
session restore 时跳过损坏的 JSONL 行并保留有效事件
provider rate limit 错误被归一成可重试失败
同一个 run 的 start、tool、finish 事件顺序稳定
```

### 真实 bug 回归

如果一个 bug 可以被一个小输入和一个小输出复现，就写 Unit Test。

测试名应该描述用户可观察到的问题，而不是内部修复方式。

```text
GOOD: restores valid session events when one JSONL line is malformed
BAD: calls parseJsonlLine inside restoreSession
```

## Unit Test 不应该测什么

### 不测 React 内部结构

不要为了这些东西写 Unit Test：

```text
className
data-slot
DOM 层级
组件内部拆分
hook 调用了哪个 helper
render 次数
```

这些测试会在重构时失败，但用户行为没有变。

如果用户真的关心这个效果，应该由 E2E 测用户可见结果。

### 不 mock 自己项目里的内部模块

Unit Test 可以 mock 系统边界，例如时间、随机数、文件系统、外部 API。

不要 mock 自己控制的内部模块，然后断言它被调用。

```text
GOOD: 输入 session events，断言恢复后的 session state
BAD: mock restoreMessages，然后断言它被调用一次
```

### 不测框架调用细节

不要把测试写成框架 API 的调用记录。

例如：

```text
React Query 有没有 invalidateQueries
router 有没有 navigate
某个 hook 有没有 setState
某个 callback 有没有被调用三次
SQLite client 有没有调用 execute
JSONL writer 有没有调用 appendLine
```

如果这是产品行为，就通过公开接口或用户可见结果验证。

如果只是实现方式，就不要测。

### 不重复 E2E 已经稳定覆盖的点击流

用户点击、输入、打开弹窗、切换状态这类完整路径，优先交给 E2E。

Unit Test 只保留这条路径背后最小、稳定、可组合的规则。

例如：

```text
E2E: 用户发送消息后能恢复历史对话
Unit: JSONL session events 能恢复成正确 session state
```

## TDD 时怎么写 Unit Test

不要一次性把所有 Unit Test 写完。

TDD 应该按垂直切片推进：

```text
1. 先确定一个用户行为
2. 找出这个行为背后最小的稳定规则
3. 为这条规则写一个失败的 Unit Test
4. 写最少代码让它通过
5. 把规则接回真实 UI、runtime 或服务
6. 用 E2E 证明用户路径真的可用
```

每一轮只写一个新的行为或一个新的边界。

不要提前为未来可能出现的状态、接口或抽象写测试。

## 和 Feature / E2E 的关系

Feature 文件表达用户路径。

E2E 测试证明用户路径能跑通。

Unit Test 证明用户路径背后的稳定规则不会坏。

例如：

```text
Feature:
用户发送消息后，能看到 assistant 回复、tool 状态和最终结果。

E2E:
真实打开窗口，输入消息，等待回复完成，检查页面上出现结果。

Unit:
给定 runtime events，断言持久化后的 session events 能恢复出正确的消息和 run 状态。
```

Unit Test 不是 Feature 的替代品，也不是 E2E 的低配版。

## 当前项目里的取舍

在 `chat` 模块里，下面这类测试更符合 Unit Test 原则：

```text
thread 分组和排序
context reference parse / format
context candidate 过滤和排序
agent message parts 到产品模型的翻译
session JSONL event parse / restore
provider stream event normalization
storage path / profile resolution
```

下面这类测试应该删掉、改写，或交给 E2E：

```text
组件 DOM 结构
className 和 data-slot
点击后弹窗是否打开
React Query cache 是否调用某个 API
render 次数
mock 内部模块后的调用断言
DB / file writer 的调用次数
```

默认规则：如果测试读起来像用户或调用方关心的行为，就保留；如果读起来像当前实现方式，就删除。
