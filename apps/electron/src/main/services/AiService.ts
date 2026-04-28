import OpenAI from "openai";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { readConfig } from "../config";
import type { ContextDTO } from "@shared/context";

export class AiService extends IpcService {
  static readonly groupName = "ai";

  private getClient(): OpenAI {
    const config = readConfig().aiProvider;
    if (!config?.apiKey) {
      throw new Error("请先在设置中配置 AI Provider");
    }
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  @IpcMethod()
  async generateSummary(content: string, contexts?: ContextDTO[]): Promise<string> {
    if (!content.trim()) {
      throw new Error("笔记内容为空，无法生成摘要");
    }

    const config = readConfig().aiProvider;
    const client = this.getClient();

    const sourceTypeLabel: Record<ContextDTO["sourceType"], string> = {
      experience: "亲身经历",
      video: "视频",
      book: "书",
      article: "文章",
      opinion: "观点",
      ai: "AI",
    };

    const contextsSection =
      contexts && contexts.length > 0
        ? `\n\n来源背景（仅供参考，标题应聚焦于笔记内容本身）：\n${contexts
            .map((ctx) => {
              const label = sourceTypeLabel[ctx.sourceType];
              const source = ctx.sourceName ? `《${ctx.sourceName}》` : "";
              const snippet =
                ctx.content.length > 80 ? ctx.content.slice(0, 80) + "…" : ctx.content;
              return `[${label}]${source} ${snippet}`;
            })
            .join("\n")}`
        : "";

    const response = await client.chat.completions.create({
      model: config?.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `给下面这段笔记起一个标题，让作者日后扫一眼就能想起"哦，这条说的是什么观点/结论"。标题必须聚焦在【笔记内容本身】，来源背景只是辅助理解的背景，不得成为标题主体。

结构：[主题]：[核心结论或关键判断]
- 冒号前：是关于什么领域/问题的（2-6字）
- 冒号后：这条笔记最核心的那个结论、观点或反直觉的发现（5-10字），必须是名词短语，不是动词句
- 冒号后必须是具体的，不能是泛泛的描述（例如"重要性"、"本质"、"方法论"这类词没有信息量）
- 整体不超过 18 字
- 好例子："纠结的根源：无试错求正确"、"交易工程：边界与极端测试"
- 坏例子："追求零试错换来永久后悔怀疑"（冒号后是句子）、"任务驱动应改为质量驱动"（整句话无结构）
- 只输出标题本身，不加引号或任何格式`,
        },
        {
          role: "user",
          content: `笔记内容：\n${content}${contextsSection}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error("AI 未返回有效摘要");
    }
    return summary;
  }
}
