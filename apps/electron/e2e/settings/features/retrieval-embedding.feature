# language: zh-CN
@settings @retrieval @v1.1.0
功能: 用户准备和维护本地语义检索
  用户希望 Reflecta 能用本地 embedding 模型做语义检索，同时在模型未准备好时仍能继续使用基础检索。

  @P0 @settings @retrieval @EMBEDDING-SETTINGS-001
  场景: 用户查看默认本地 embedding 模型并触发下载
    假如用户打开设置
    当用户进入语义检索设置
    那么用户应该看到默认模型 Qwen3 Embedding 0.6B
    而且用户应该看到该模型是本地 embedding 模型
    当用户点击下载默认 embedding 模型
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
