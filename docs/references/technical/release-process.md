# 发版流程

## 步骤

1. 切到 master。

   ```bash
   git switch master
   ```

2. 确认当前 commit 是要发布的版本。

   ```bash
   git status --short --branch
   git log --oneline -1
   ```

3. 同步版本号和 `CHANGELOG.md`。
   - package 版本号必须与本次 tag 一致。
   - `CHANGELOG.md` 必须包含本次发布条目。
   - iteration 文档按版本号放到 `docs/iterations/vX.Y.Z/`。
   - 如果补发历史版本，也要在同一次改动里补齐对应 changelog。

4. 跑发版前校验。

   ```bash
   bun run typecheck
   bun run test
   ```

5. 提交发版改动。

   ```bash
   git add CHANGELOG.md package.json apps packages bun.lock docs/references/technical/release-process.md
   git commit -m "chore(release): vX.Y.Z"
   ```

6. 创建版本 tag。

   ```bash
   git tag vX.Y.Z
   ```

7. 推送 master。

   ```bash
   git push origin master
   ```

8. 推送版本 tag。

   ```bash
   git push origin vX.Y.Z
   ```
