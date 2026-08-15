- 完成长任务或阶段性成果后及时 commit，commit 遵循 `Angular Commit Convention`，commit 信息用英文。

- `docs/references/**` 是现行规范；`docs/iterations/**` 默认只作历史背景，
  除非任务明确涉及对应版本或需要追溯设计决策。

- 讨论产品价值、理念或方向前，阅读
  [value-proposition.md](docs/references/product/value-proposition.md)；
  定义功能范围时额外阅读
  [feature-set-guide.md](docs/references/product/feature-set-guide.md)。

- 编写或 Review 前端代码前，阅读
  [frontend-guide.md](docs/references/technical/frontend-guide.md)；

- 判断组件是否进入 Storybook，或新增、修改 Showcase / Story 前，阅读
  [storybook-principles.md](docs/references/technical/storybook-principles.md)。

- 修改 Feature、Gherkin 或 Acceptance 时，额外阅读
  [test-case-principles.md](docs/references/technical/test-case-principles.md)；
  修改 Electron E2E 时，同时阅读 [E2E README](apps/electron/e2e/README.md)。

- 准备版本、CHANGELOG、release commit 或 tag 前，阅读
  [release-process.md](docs/references/technical/release-process.md)。

- 修改业务模块语义或跨层流程前，检查
  `docs/references/technical/biz/<module>/`，只阅读与当前子领域相关的文档。
