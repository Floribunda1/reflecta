# Citation 真实模型 A/B 报告

- 时间：2026-07-18T18:08:11.104Z
- Provider / Model：openai-codex / gpt-5.6-sol
- Reasoning：high
- 样本：numbered 40，direct 40
- 结论：**PASS**

| 指标                    | numbered |   direct |
| ----------------------- | -------: | -------: |
| 引用 coverage           |   100.0% |   100.0% |
| type + ID 绑定正确      |   100.0% |   100.0% |
| 工具参数正确            |   100.0% |   100.0% |
| malformed / unknown     |        0 |        0 |
| 工具 display token 污染 |        0 |        0 |
| UI raw protocol 泄漏    |        0 |        0 |
| Provider error          |        0 |        0 |
| 本地 parse/render p95   | 0.032 ms | 0.047 ms |

| 场景                 | numbered coverage | direct coverage |
| -------------------- | ----------------: | --------------: |
| 显式引用一个实体     |               5/5 |             5/5 |
| 读取工具返回后引用   |               5/5 |             5/5 |
| 同类型多个实体       |               5/5 |             5/5 |
| 三种实体混合         |               5/5 |             5/5 |
| 下一轮继续引用       |               5/5 |             5/5 |
| 引用并读取同一实体   |               5/5 |             5/5 |
| 引用一个并修改另一个 |               5/5 |             5/5 |
| Markdown 混合        |               5/5 |             5/5 |

## 判定

真实模型 evaluator 只使用 exact token、ID/type 和工具参数检查。title 改名、删除、重启与真实 UI 路径由 AG-RESULT-004/008/009/010/011 E2E 单独验证。

原始结果见 [citation-reliability-raw.json](./citation-reliability-raw.json)。
