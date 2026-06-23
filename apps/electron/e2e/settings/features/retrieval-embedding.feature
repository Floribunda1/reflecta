# language: zh-CN
@settings @retrieval @v1.1.0
功能: Retrieval embedding 设置
  用户希望 Reflecta 能用本地 embedding 模型做语义检索，同时在模型未准备好时仍能继续使用基础检索。

  @P0 @settings @retrieval @EMBEDDING-SETTINGS-001
  场景: 用户查看默认本地 embedding 模型并触发下载
    假如用户打开设置
    当用户进入 Retrieval 设置
    那么用户应该看到默认模型 Qwen3 Embedding 0.6B
    而且用户应该看到该模型用于本地语义检索
    当用户点击下载默认 embedding 模型
    那么用户应该看到模型下载已完成
