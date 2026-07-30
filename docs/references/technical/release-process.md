# 发版流程

> 组织逻辑：按“一次性准备 → 每次发版 → 自动产物 → 限制”排列。原因是 Sparkle
> 密钥只配置一次，而版本、changelog 和 tag 是每次发布都要重复执行的动作。

## 一次性准备

macOS 更新使用 Sparkle 的 Ed25519 密钥，不需要 Apple Developer 账号、Developer ID
或 App Store。

公钥已经写入 Electron 的 `Info.plist` 配置。拥有仓库发布权限的维护者还需要创建：

```text
Name: SPARKLE_PRIVATE_KEY
Value: 与应用内公钥匹配的 Sparkle Ed25519 私钥
```

私钥只允许保存在维护者的安全备份和 GitHub Actions Secret 中，不能提交到仓库、
Issue、日志或构建产物。普通贡献者不需要获得私钥，也不能从公钥反推出私钥。

`GITHUB_TOKEN` 不需要创建。GitHub Actions 会为每次 workflow 自动提供临时 token，
workflow 只用它创建当前仓库的 Release。

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

推送 tag 后，`.github/workflows/release-electron.yml` 会自动完成：

1. 校验 tag、`apps/electron/package.json` 版本和 `CHANGELOG.md` 条目一致。
2. 在 GitHub 的 arm64 macOS runner 上构建带标准交互的 Sparkle 2.9.4 helper 和 Electron App。
3. 生成 DMG、完整更新 ZIP、`appcast.xml` 和从上一版本升级的 delta。
4. 从本次 `CHANGELOG.md` 条目生成 GitHub Release 说明。
5. 创建 GitHub Release 并上传全部产物。

客户端启动 15 秒后检查一次，之后每 6 小时检查一次；也可以从 macOS 应用菜单选择
“检查更新…”。自动检查无更新时保持静默；手动检查会显示检查结果。发现更新后，
Sparkle 的标准窗口统一承接 changelog、跳过/稍后提醒、下载进度、安装和重启。

## 限制

- Sparkle 只负责 macOS。当前 workflow 只发布 Apple Silicon 的 arm64 包。
- 第一个包含 Sparkle 的版本仍需用户手动安装；从下一个版本开始才能验证完整更新链路。
- 没有 Developer ID 时，首次下载仍可能出现 macOS Gatekeeper 警告；Sparkle 的
  Ed25519 签名只解决后续更新包的来源和完整性验证。
- 本机构建 Sparkle helper 需要 macOS Command Line Tools。普通开发只需运行应用构建，
  正式打包交给 GitHub Actions。
- workflow 只在上游 `Floribunda1/reflecta` 仓库发布。Fork 需要生成自己的 Sparkle
  密钥，并替换公钥、feed URL、GitHub API URL 和 workflow 仓库判断，不能获得或复用
  上游私钥。
