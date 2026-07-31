# language: zh-CN
@settings @retrieval @v1.1.0
功能: 用户配置和维护本地语义检索
  用户希望 Reflecta 能用本地 embedding 模型做语义检索，同时在模型未准备好时仍能继续使用基础检索。

  @P0 @settings @retrieval @EMBEDDING-SETTINGS-001
  场景: 用户查看默认本地 embedding 模型并触发下载
    假如用户打开设置
    当用户进入语义检索设置
    那么用户应该看到默认模型 Qwen3 Embedding 0.6B
    而且用户应该看到该模型是本地 embedding 模型
    当用户点击下载默认 embedding 模型
    而且用户等待模型下载完成
    那么用户应该看到模型已安装

  @P0 @settings @retrieval @progress @EMBEDDING-SETTINGS-002
  场景: 用户在语义检索模型准备好后重建检索索引
    假如用户打开设置
    而且语义检索模型已准备好
    当用户进入语义检索设置
    那么用户应该看到检索索引状态
    当用户点击重新构建检索索引
    那么用户应该看到索引进入构建中
    而且用户应该看到生成 embedding 的已完成数量增加
    当用户等待索引构建完成
    那么用户应该看到检索索引状态为“已就绪”

  @P1 @settings @retrieval @EMBEDDING-SETTINGS-003
  场景: 用户决定是否让 Agent 使用语义检索
    假如用户打开语义检索设置
    当用户关闭 Agent 语义检索
    那么设置应该显示语义检索已关闭
    当用户重新开启 Agent 语义检索
    那么设置应该显示语义检索已开启

  @P0 @error @EMBEDDING-SETTINGS-004
  场景: 模型下载失败后用户可以重新下载
    假如用户打开语义检索设置
    而且下一次模型下载会失败
    当用户下载默认 embedding 模型
    那么页面应该显示模型下载失败及失败原因
    而且用户应该可以选择重新下载

  @P0 @error @EMBEDDING-SETTINGS-005
  场景: 索引构建失败后用户可以重新构建
    假如语义检索模型已准备好
    而且下一次索引构建会失败
    当用户重新构建检索索引
    那么页面应该显示索引构建失败及失败原因
    而且用户应该可以再次重新构建
