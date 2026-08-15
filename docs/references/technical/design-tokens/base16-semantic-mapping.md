# Base16 与 Reflecta Semantic Token 映射

## 目的

Reflecta 使用 Base16 作为主题调色板的基础，但 Base16 本身不是完整的 GUI Design System。
Base16 的 16 个槽位是为语法高亮设计的（槽位 = 语法角色），社区没有「Base16 → GUI token」的
成熟方法论，Reflecta 采用的原则是：

- **Base16 只做换肤色板**（primitive 层）：UI 中出现的所有颜色必须来自 16 个槽位或
  基于槽位的 OKLCH 派生，不引入槽位外的裸色值。换 scheme = 换一组 base 值，整套自动和谐。
- **语义层 = shadcn 契约 + 极少量业务扩展**：shadcn 接口层名不可改；契约覆盖不到的颜色角色
  （状态色）按社区标准扩展。
- **派生色统一用 OKLCH 空间 color-mix**：sRGB 空间混色会出泥泞的中间调，OKLCH 等感知明度，
  混色平滑。UI 中只有状态色的 foreground/muted 两类派生，且各混一次。

```text
Base16 palette（16 槽位，.light/.dark 两套值）
    ↓
shadcn 接口层（~25）+ 状态色家族（4 色 × foreground/muted）
    ↓
Component / page
```

## Base16 的基本规则

- `base00`–`base07`：灰阶（背景 → 前景），方向随主题反转（Dark 从暗到亮，Light 从亮到暗）
- `base08`–`base0F`：彩色槽位（原始用于语法高亮），色相可由主题作者定制
  （如 Reflecta 将 `base0C` 定制为 teal）

## 槽位映射（最终形态）

### 灰阶

| 槽位                | Base16 语义   | GUI 角色                                                   | token                                                                  |
| ------------------- | ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `base00`            | 默认背景      | 画布 / 卡片 / 浮层                                         | `background` `card` `popover`（shadcn 契约：同色，层级靠 shadow/ring） |
| `base01`            | 浅背景        | 侧栏                                                       | `sidebar`                                                              |
| `base02`            | 选中背景      | 选中 / 分隔线                                              | `muted` `accent` `secondary` `border` `input`                          |
| `base03`            | 注释          | **不映射**（对比度 ~2:1，不足）                            | —                                                                      |
| `base04`            | 暗前景        | 次级文字                                                   | `muted-foreground`                                                     |
| `base05`            | 默认前景      | 正文                                                       | `foreground`                                                           |
| `base06` / `base07` | 亮前景 / 反色 | 不映射（无业务语义；反色场景由 `primary-foreground` 承担） | —                                                                      |

注意：选中 Ghostty 配对主题时，`primary` / `ring` / `sidebar-primary` 覆盖为该主题的
`cursor-color`（终端签名色，如 Ayu 胡萝卜 `#ffaa33`），不再用 `base0C`。`base0C` 仍注入
色板，供 chart 等使用。Default 方案继续 `primary = base0C`。

注意：`base03` 不暴露为 token（弱化文字统一用 `muted-foreground`，对比度达标）。
`border`/`input` 取 `base02`——shadcn 默认边框就是淡档（light 1.3:1，若有若无的分隔），
层级靠 shadow 表达，边框不承担对比度职责。
`base06`/`base07` 不暴露（强调用 `font-semibold` + `foreground` 表达）。

### 彩色

| 槽位                                    | token                                                                        | 用途              |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------- |
| `base08` 红                             | `destructive`（shadcn 契约）+ `danger` `danger-foreground` `danger-muted`    | 错误              |
| `base0A` 黄                             | `warning` `warning-foreground` `warning-muted`                               | 警告              |
| `base0B` 绿                             | `success` `success-foreground` `success-muted`                               | 成功              |
| `base0C` 青                             | 默认主题的 `primary` `ring`；Ghostty 方案里青槽仍在，主色改走 `cursor-color` | 默认品牌 / 色轮青 |
| `base0D` 蓝                             | `info` `info-foreground` `info-muted`                                        | 信息              |
| `base09` 橙 / `base0E` 紫 / `base0F` 棕 | `chart-4` / `chart-3` / —                                                    | 仅图表色，不进 UI |

### 状态色家族（社区标准扩展）

```css
--success: var(--base0b);
--success-foreground: color-mix(in oklch, var(--base0b) 15%, var(--foreground));
--success-muted: color-mix(in oklch, var(--base0b) 12%, var(--base00));
/* warning / info / danger 同构，muted 比例 14% / 10% / 10% */
```

- **foreground**：mix 到正文色，light 出深字 / dark 出浅字，对比度自动成立
- **muted**：mix 到画布色，出淡底（失败条、徽标）

## Semantic Token 的使用规则

1. 页面和组件优先使用 Semantic Token，不直接使用 `--base0X`。
2. 弱化文字统一用 `text-muted-foreground`，不引入第三级文字 token。
3. `base02` 直接承担 selection、hover、active（shadcn 契约名已覆盖，不另建别名）。
4. 容器层级优先用 border + shadow 表达（shadcn 契约），不引入「比画布亮一档」的容器色。
5. `border`/`input` 取 `base02`（shadcn 默认淡边框档，层级靠 shadow）。
6. `primary-foreground` / `destructive-foreground` 是双端校准值：teal 上用深字（light base07 / dark base00），红上用近白字（light mix base00 / dark mix base07，OKLCH）。
7. 不在基础层生成 entity 专属 token、交互状态 token 或大规模状态 token 家族。
8. 派生色（状态色 foreground/muted、destructive-foreground）统一 OKLCH 空间，混一次，不叠加。

## 调整记录（本次）

- 删除全部 Atlassian 引入的语义 token：`interaction-*`、`selected*`、`fill*`、`surface*`、
  `icon-*`、`brand*`、`foreground-muted/subtle/strong/high-contrast`、`inverse`、`disabled`、
  `attention`、`deprecated`、`border-muted/strong/selected/focused/disabled`、
  `elevation-*`、`blanket`、`z-*`、`opacity-*`、`warning`/`information`（旧名）、
  `warning-muted`/`success-muted`/`info-muted`（旧值，sRGB）
- 状态色家族统一为 `success/warning/info/danger` ×（实色 / foreground / muted），mix 改用 OKLCH
- 消费点平替：`fill`→`muted`/`background`、`foreground-subtle/muted`→`muted-foreground`、
  `surface`→`background`、`surface-raised/50`→`sidebar/50`、`interaction-hovered`→`muted`、
  `border-muted`→`border`、`border-selected`→`primary`、`fill-secondary`→`muted`
- 最终形态：shadcn 契约 ~25 + 状态色 12 + 比例尺（radius/排版），共 1 个文件

## 参考

- [Base16 Styling Guidelines](https://github.com/tinted-theming/home/blob/main/styling.md)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [base24-to-shadcn（社区映射示例，非标准）](https://github.com/jan5o7o/base24-to-shadcn)
