# Design Decision: 用户设置页面

## 页面目标

用户修改个人信息与账号安全设置。操作频率低，桌面端为主。
核心体验要求：每个操作区块边界清晰，操作结果明确，不产生误操作。

---

## Template

页面级布局和区块排列顺序。

```
SettingsPage
  max-w-2xl mx-auto
  px-4 py-6（移动端）/ px-8 py-10（桌面端）

  PageHeader
    h1「账号设置」        → text-2xl font-bold tracking-tight
    描述文字              → text-sm text-muted-foreground mt-1
    与内容区间距          → mb-8

  内容区（垂直单列，gap-6）
    └─ ProfileCard
    └─ EmailCard
    └─ PasswordCard
    └─ DangerCard
```

排列逻辑：按操作频率从高到低，DangerCard 强制置底。

---

## Organisms

每个独立功能区块的内部结构。所有区块使用 `Card` 作为容器。

- **ProfileCard**

  ```
  Card
    CardHeader
      CardTitle        「个人信息」
      CardDescription  「更新你的头像和用户名」
    CardContent
      AvatarUploader
      Separator
      FormField        用户名
      FormField        个人简介（Textarea）
    CardFooter
      CardAction
  ```

  - 保存成功 → Toast 右下角，3 秒消失
  - 保存失败 → 对应字段内联错误，不用 Toast

- **EmailCard**

  ```
  Card
    CardHeader
      CardTitle        「邮箱地址」
    CardContent
      FormField        当前邮箱（disabled）
      FormField        新邮箱
      FormField        确认新邮箱
    CardFooter
      CardAction
  ```

  - 当前邮箱 disabled，样式降级为 text-muted-foreground
  - 更新后发送验证邮件，Toast 提示「验证邮件已发送」

- **PasswordCard**

  ```
  Card
    CardHeader
      CardTitle        「修改密码」
    CardContent
      FormField        当前密码（password type）
      FormField        新密码（password type + 强度 HelperText）
      FormField        确认新密码（password type）
    CardFooter
      CardAction
  ```

  - 密码强度：HelperText 实时文字反馈（弱 / 中 / 强），不用进度条
  - 两次密码不一致：失焦后立即显示错误，不等提交

- **DangerCard**
  ```
  Card
    CardHeader
      CardTitle        「危险操作」（text-destructive）
    CardContent
      DangerZone       删除账号
  ```

  - 点击删除 → AlertDialog 二次确认，不直接执行

---

## Molecules

区块内反复出现的组合单元，定义内部结构和间距规则。

- **FormField** = Label + Input + HelperText
  - 布局：`flex flex-col gap-1.5`
  - 错误触发：Input 失焦后校验，不等提交
  - HelperText 无内容时不渲染，不占位

- **AvatarUploader** = Avatar + Button
  - 布局：`flex items-center gap-4`
  - Button 文案：「更换头像」，Ghost variant
  - 上传中：Button loading 状态，Avatar 半透明遮罩

- **CardAction** = Button(取消) + Button(保存)
  - 布局：`flex justify-end gap-2`
  - 顺序：Ghost（取消）在左，Default（保存）在右

- **DangerZone** = 说明文字 + Button
  - 布局：`flex items-center justify-between`
  - 说明文字描述操作后果，不能只有按钮

---

## Design Tokens 使用表

本页面使用的语义 token 及其边界，用来检查跨区块一致性。

| Token 类型 | Token / Class | 使用场景 | 禁止用法 |
| ---------- | ------------- | -------- | -------- |
| Text | `text-2xl font-bold tracking-tight` | PageHeader 主标题 | 不用于 CardTitle，避免区块标题抢页面标题层级 |
| Text | `text-sm text-muted-foreground` | PageHeader 描述文字、FormField HelperText、当前邮箱 disabled 文本 | 不用于主标题、字段 Label、危险操作文案 |
| Text | `text-destructive` | DangerCard 标题、字段错误提示 | 不用于普通说明、warning 或次级信息 |
| Surface | `Card` 默认背景 | ProfileCard、EmailCard、PasswordCard、DangerCard 容器 | 不嵌套 Card 形成额外背景层级 |
| Border | `Card` 默认 border | 所有 Organism 的区块边界 | 不叠加 shadow 表达同一层级 |
| Spacing | `px-4 py-6` / `px-8 py-10` | 页面容器移动端 / 桌面端 padding | 不用于 Card 内部 padding |
| Spacing | `mb-8` | PageHeader 与内容区间距 | 不用于 Card 内部元素间距 |
| Spacing | `gap-6` | 内容区 Organism 垂直间距 | 不用于 FormField 或按钮组 |
| Spacing | `gap-4` | AvatarUploader 内部头像与按钮间距 | 不用于表单字段内部 |
| Spacing | `gap-2` | CardAction 按钮组间距 | 不用于页面区块间距 |
| Spacing | `gap-1.5` | FormField 内部 Label、Input、HelperText 间距 | 不用于 Organism 间距 |
| State | `disabled` | EmailCard 当前邮箱 Input | 不用于表达只读说明文字，说明文字继续使用 `text-muted-foreground` |
| State | `Button loading` | AvatarUploader 上传中、保存按钮提交中 | 不用 Toast 表达进行中状态 |
| Action | `Button Default` | 主要保存操作 | 不用于取消、删除或低风险次要操作 |
| Action | `Button Ghost` | 取消、更换头像 | 不用于主要提交 |
| Action | `Button Ghost + destructive` | 删除账号入口 | 不做成 Destructive 填充按钮，避免危险操作过度突出 |

---

## Atoms 索引

本页面使用的 shadcn 组件及 variant 配置，不在此处做设计决策。

| 组件                                         | Variant / 配置      | 使用位置                        |
| -------------------------------------------- | ------------------- | ------------------------------- |
| Button                                       | Default             | CardAction 保存按钮             |
| Button                                       | Ghost               | CardAction 取消、AvatarUploader |
| Button                                       | Ghost + destructive | DangerZone 删除账号             |
| Input                                        | default variant     | 所有文字输入 FormField          |
| Input                                        | type="password"     | PasswordCard 三个字段           |
| Input                                        | disabled            | EmailCard 当前邮箱              |
| Textarea                                     | default variant     | ProfileCard 个人简介            |
| Avatar                                       | size-16             | AvatarUploader                  |
| Card / CardHeader / CardContent / CardFooter | default variant     | 所有 Organism 容器              |
| Separator                                    | default variant     | ProfileCard 头像与表单之间      |
| Toast                                        | default variant     | 保存成功反馈                    |
| AlertDialog                                  | default variant     | DangerCard 删除确认             |

---

## 不做的决策

- ❌ **不用 Tabs 切换区块** → 内容量不足，一屏展示让用户看到全貌
- ❌ **不在 Card 外加 shadow** → border 已有足够边界感，阴影造成层级混乱
- ❌ **不嵌套 Card** → 背景色层级控制在 3 层以内
- ❌ **不用密码强度进度条** → HelperText 文字反馈已足够，进度条增加视觉噪音
- ❌ **不用 Modal 确认普通保存** → 只有删除账号需要 AlertDialog
- ❌ **不把删除按钮做成 Destructive 填充** → Ghost + destructive 已足够传达危险性
- ❌ **不在移动端隐藏任何区块** → 所有设置项移动端同样可见
