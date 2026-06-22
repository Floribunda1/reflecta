# Test Case 写作原则

这份文档用于逐渐积累项目里的 test case 写作原则。新增内容只记录已经明确提出并确认的原则，不自动扩展、不替换原意。

## 原则

### 先写 test case

Test case 应该先于 E2E、unit、integration 等后续测试实现方式被定义。

后续测试怎么落地，应该从 test case 派生；不要一开始就从 E2E 或 unit 的角度倒推 test case。

### 有组织地写 test case

Test case 不是 bullet list。

Test case 应该有组织地描述用户场景，而不是把零散检查点堆成列表。

### Test case 只保留必要字段

每个 test case 只需要：

```text
ID
目标
前置条件
步骤
期望结果
```

不要把后续流程信息写进 test case 本身。

### 只对用户场景负责

Test case 只需要对用户场景负责。

Test case 不对任何技术细节负责。它的出发点应该是终端用户实际看到的表现和产品预期，而不是当前技术实现。

### 期望结果写正确结果

Test case 应该保证能得到正确结果，而不是测试“不会得到某个错误结果”。

例如，打开 Agent 模块的 test case 应该描述用户应该看到的 Agent 页面状态；不要写成“打开 Agent 模块时不应该出现数据分析看板”。
