# language: zh-CN
@capture @domain @v1.2.5
功能: 用户管理自己的长期 Domain
  用户需要创建和调整 Domain 层级，用它们限定回看 Understanding 的范围，并在调整分类后继续找到自己的理解。

  @P0 @happy_path @CP-DOMAIN-007
  场景: 用户创建根 Domain
    假如用户已经进入 Capture 页面
    当用户新建名为 NEW_ROOT_DOMAIN 的根 Domain
    那么 Domain Tree 应该显示 NEW_ROOT_DOMAIN
    而且用户选择 NEW_ROOT_DOMAIN 后，Dashboard 的领域 chips 应该选中 NEW_ROOT_DOMAIN

  @P0 @happy_path @CP-DOMAIN-008
  场景: 用户在已有 Domain 下创建子 Domain
    假如 seed 数据中存在根 Domain「Programming」
    当用户从 Domain「Programming」的菜单新建名为 NEW_CHILD_DOMAIN 的子 Domain
    那么 Domain「Programming」应该保持展开
    而且 NEW_CHILD_DOMAIN 应该显示在 Domain「Programming」下面

  @P0 @editing @CP-DOMAIN-009
  场景: 用户修改 Domain 的名称和父级
    假如 seed 数据中存在根 Domain「Programming」和「Design」
    而且 Domain「Programming」下存在子 Domain「DevOps」
    当用户把 Domain「DevOps」重命名为 RENAMED_DOMAIN
    而且用户把它的父 Domain 改为「Design」
    那么 RENAMED_DOMAIN 应该显示在 Domain「Design」下面
    而且用户选择 RENAMED_DOMAIN 后，Dashboard 的领域 chips 应该选中 RENAMED_DOMAIN

  @P0 @safety @CP-DOMAIN-010
  场景: 用户删除 Domain 后仍能从全部领域找到原有理解
    假如 seed 数据中存在 Domain「Programming」
    而且该 Domain 下存在 Understanding「React Server Components」
    而且该 Domain 下存在子 Domain「Frontend」
    当用户删除 Domain「Programming」并确认
    那么 Domain Tree 应该回到“全部领域”
    而且原来的子 Domain「Frontend」应该作为根 Domain 继续显示
    而且卡片网格应该继续显示 Understanding「React Server Components」

  @P0 @safety @CP-DOMAIN-011
  场景: 用户修改父 Domain 时只看到有效选项
    假如 seed 数据中存在根 Domain「Programming」和「Design」
    而且 Domain「Programming」下存在子 Domain「Frontend」
    当用户编辑 Domain「Programming」
    而且用户打开父 Domain 选项
    那么父 Domain 选项应该包含「Design」
    而且选项应该只包含「Programming」子树以外的 Domain

  @P0 @happy_path @CP-DOMAIN-001
  场景: 用户拖动根级 Domain 调整顺序
    假如 seed 数据中存在根级 Domain「Programming」和「Design」
    当用户把左导航栏中的 Domain「Design」拖到 Domain「Programming」前面
    那么 Domain Tree 中「Design」应该显示在「Programming」前面
    而且用户离开并回到 Capture 页面后，Domain Tree 仍然保持「Design」在「Programming」前面

  @P1 @navigation @CP-DOMAIN-005
  场景: 用户收起后从导航栏恢复 Domain Tree
    假如用户已经进入 Capture 页面
    当用户收起导航栏
    那么导航栏应该收窄为模块图标
    而且 Domain Tree 应该隐藏
    当用户展开导航栏
    那么 Domain Tree 应该恢复显示
