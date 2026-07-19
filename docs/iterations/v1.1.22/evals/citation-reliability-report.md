# Citation 真实模型 A/B 报告

- 时间：2026-07-19T02:52:11.845Z
- Provider / Model：deepseek / deepseek-v4-flash
- Reasoning：high
- 样本：numbered 20 个会话 / 220 轮，direct 20 个会话 / 220 轮
- 压力规模：最多 64 个实体、14 轮对话；每个会话要求 43–58 次 citation
- 身份可靠性：**PASS**
- 严格 exact-once：**FAIL**

本报告只调用上述 DeepSeek 模型，没有调用 OpenAI/GPT。

| 指标                    | numbered |   direct |
| ----------------------- | -------: | -------: |
| 完整会话通过            |    15/20 |    19/20 |
| 每轮目标 coverage       |    96.4% |   100.0% |
| 只选择指定实体且各一次  |    94.5% |    99.5% |
| type + ID 绑定正确      |   100.0% |   100.0% |
| 长对话末轮重新引用      |   100.0% |   100.0% |
| 工具参数正确            |   100.0% |   100.0% |
| 要求 citation 总数      |     1000 |     1000 |
| malformed / unknown     |        0 |        0 |
| 工具 display token 污染 |        0 |        0 |
| UI raw protocol 泄漏    |        0 |        0 |
| Provider error          |        0 |        0 |
| 本地 parse/render p95   | 0.055 ms | 0.064 ms |

| 场景                         | numbered：通过轮次；末轮 | direct：通过轮次；末轮 |
| ---------------------------- | -----------------------: | ---------------------: |
| 64 个实体中的延迟引用        |          36/40；末轮 5/5 |        40/40；末轮 5/5 |
| 近似 ID 与 citation 密集历史 |          70/70；末轮 5/5 |        70/70；末轮 5/5 |
| 同名跨类型实体               |          45/50；末轮 5/5 |        50/50；末轮 5/5 |
| 工具新增实体与 Markdown 噪声 |          57/60；末轮 5/5 |        59/60；末轮 5/5 |

## 判定

真实模型 evaluator 对每一轮都使用 exact token、目标集合、ID/type 和工具参数检查；末轮单独检查长历史后的重新引用。title 改名、删除、重启与真实 UI 路径仍由 AG-RESULT-004/008/009/010/011 E2E 验证。

- direct 在 220 轮中保持目标 coverage、type + ID、末轮重新引用和工具参数全部正确；
- direct 有 1 轮只因重复了一个正确 citation，未通过“指定实体各一次”，这不是 ID 或 type 串线；
- numbered 有 12 轮出现漏引、错选或重复，压力场景下明显弱于 direct；
- 因此可以判断：实体数量和对话长度没有破坏 direct ID 引用身份；如果产品要求 citation 绝不重复，还需要单独收紧生成规则。

原始结果见 [citation-reliability-raw.json](./citation-reliability-raw.json)。
