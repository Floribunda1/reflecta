# Electron E2E suites

Electron E2E 按测试意图分成两个 suite：

- `acceptance/feature/<module>/`：按产品模块集中维护 Feature 文件。
- `acceptance/spec/<module>/`：按相同模块维护 acceptance spec 和模块内 helper。每个 `test()` 必须以对应的稳定 Feature ID 开头。
- `regression/`：保护必须经过真实 Electron 边界验证的技术风险或历史缺陷，不创建 Feature，也不使用 Feature ID。

共享的环境生命周期保留在本目录根部。只有当多个 suite 确实需要同一 helper 时，再把 helper 提升到公共目录。

```bash
bun run test:e2e
bun run test:e2e:acceptance
bun run test:e2e:regression
bun run feature:check
bun run feature:diff -- origin/master
```

`feature:check` 校验 acceptance Feature 与测试实现可双向追踪，并阻止 regression 冒用 Feature ID。`feature:diff` 按稳定 ID 汇总相对指定 Git ref 的产品契约变化，供人工 review 使用。
