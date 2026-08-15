# language: zh-CN
@settings @appearance
功能: 用户选择应用外观
  用户需要选择亮暗配对主题，并为每个主题指定主色，以便界面保持自己习惯的配色。

  @P0 @happy_path @APPEARANCE-SETTINGS-001
  场景: 用户选择主题后界面使用该主题
    假如用户打开外观设置
    当用户选择主题 Ayu
    那么界面应该使用主题 Ayu

  @P0 @happy_path @APPEARANCE-SETTINGS-002
  场景: 用户为某个主题选择主色
    假如用户打开外观设置
    而且当前主题是 Ayu
    当用户为 Ayu 选择主色 base0D
    那么界面主色应该是 Ayu 的 base0D

  @P1 @happy_path @APPEARANCE-SETTINGS-003
  场景: 用户恢复该主题自带主色
    假如用户已经为 Ayu 选择了主色 base0D
    当用户恢复 Ayu 的默认主色
    那么界面主色应该是 Ayu 自带的强调色

  @P1 @recovery @APPEARANCE-SETTINGS-004
  场景: 用户重启后仍使用上次的主题和主色
    假如用户已经选择主题 Ayu
    而且用户已经为 Ayu 选择主色 base0D
    当用户关闭并重新打开 Reflecta 应用
    而且用户打开外观设置
    那么当前主题应该仍是 Ayu
    而且界面主色应该仍是 Ayu 的 base0D
