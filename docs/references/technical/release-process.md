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

3. 创建版本 tag。

   ```bash
   git tag vX.Y.Z
   ```

4. 推送 master。

   ```bash
   git push origin master
   ```

5. 推送版本 tag。

   ```bash
   git push origin vX.Y.Z
   ```
