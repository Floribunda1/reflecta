const headingsAndInline = `# H1 一级标题

## H2 二级标题

### H3 三级标题

#### H4 四级标题

##### H5 五级标题

###### H6 六级标题

---

## 文字样式

普通文本正常显示。

**粗体文字** 和 __也是粗体__

*斜体文字* 和 _也是斜体_

***粗斜体文字*** 和 ___也是粗斜体___

~~删除线文字~~

\`行内代码 inline code\`

使用反斜杠转义：\\*不是斜体\\* \\**不是粗体\\** \\\`不是代码\\\`

[普通链接](https://www.example.com) · <https://www.example.com>
`;

const listsAndQuotes = `## 列表与引用

> 这是一段引用文字。
> 可以多行连续引用。

> 嵌套引用第一层
>> 嵌套引用第二层
>>> 嵌套引用第三层

### 无序列表

- 项目一
- 项目二
  - 子项目 A
  - 子项目 B
    - 子子项目 i
    - 子子项目 ii
- 项目三

### 有序列表

1. 第一步
2. 第二步
   1. 子步骤 2.1
   2. 子步骤 2.2
3. 第三步

### 任务列表

- [x] 已完成任务
- [x] 另一个已完成任务
- [ ] 未完成任务
- [ ] 待办事项
`;

const codeAndTables = `## 代码块

\`\`\`javascript
function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
\`\`\`

\`\`\`css
.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
\`\`\`

\`\`\`json
{
  "name": "markdown-test",
  "version": "1.0.0",
  "dependencies": {
    "react": "^19.0.0",
    "typescript": "^5.9.0"
  }
}
\`\`\`

\`\`\`bash
echo "Hello, World!"
git clone https://github.com/example/repo.git
cd repo && bun install && bun run build
\`\`\`

## 表格

| 姓名 | 年龄 | 职业 |
| --- | ---: | :---: |
| 张三 | 28 | 工程师 |
| 李四 | 34 | 设计师 |
| 王五 | 25 | 产品经理 |

| 左对齐 | 居中对齐 | 右对齐 |
| :--- | :---: | ---: |
| Left | Center | Right |
| 100 | 200 | 300 |
`;

const mediaAndExtensions = `## 链接与图片

[带 title 的链接](https://www.example.com "悬停提示文字")

[引用式链接][ref-link]

[ref-link]: https://www.example.com "引用链接的 title"

![稳定的内嵌图片](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ccircle cx='110' cy='120' r='58' fill='%2394a3b8'/%3E%3Ctext x='210' y='132' fill='%23334155' font-size='28'%3EReflecta Markdown%3C/text%3E%3C/svg%3E "图片 title")

## HTML 内嵌

<details>
  <summary>点击展开折叠内容</summary>

  这里是折叠隐藏的内容。

- 支持列表
- 支持**粗体**

</details>

<mark>高亮文字</mark>

<kbd>Ctrl</kbd> + <kbd>C</kbd> 复制

<sup>上标文字</sup> 和 <sub>下标文字</sub>

## 脚注与定义列表

这是一段带有脚注的文字[^1]，这里还有另一个脚注[^note]。

[^1]: 这是第一个脚注的内容。
[^note]: 这是命名脚注的内容，支持**Markdown**格式。

Markdown
:   一种轻量级标记语言

HTML
:   超文本标记语言
:   用于构建网页结构
`;

const mathAndNested = `## 数学公式

质能方程：$E = mc^2$，欧拉公式：$e^{i\\pi} + 1 = 0$

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\begin{pmatrix}
x \\\\
y
\\end{pmatrix}
=
\\begin{pmatrix}
ax + by \\\\
cx + dy
\\end{pmatrix}
$$

## Mermaid 图表

\`\`\`mermaid
flowchart LR
  Capture["记录"] --> Reflect["反思"]
  Reflect --> Understand["形成理解"]
\`\`\`

## 综合嵌套示例

> ### 引用中的标题
>
> 引用块内可以包含其他 Markdown 元素：
>
> - **粗体列表项**
> - *斜体列表项*
> - \`代码列表项\`
>
> \`\`\`python
> print("Hello from blockquote!")
> \`\`\`
>
> | 表格列 A | 表格列 B |
> | --- | --- |
> | 引用中 | 的表格 |

关联内容：[[分区灌溉策略#understanding-irrigation]]、[[夜班联调记录#context-night-shift]]。
`;

export const markdownStorySections = {
  headingsAndInline,
  listsAndQuotes,
  codeAndTables,
  mediaAndExtensions,
  mathAndNested,
} as const;

export const fullMarkdownStoryDocument = Object.values(markdownStorySections).join("\n\n---\n\n");

export const markdownBoundaryDocument = `${fullMarkdownStoryDocument}

---

## 几何边界

\`\`\`text
${"bun run --filter @reflecta/ui build-storybook --reporter=verbose ".repeat(8)}
\`\`\`

| 很长的列标题 | 第二列 | 第三列 | 第四列 |
| --- | --- | --- | --- |
| ${"不会主动截断但必须留在容器内 ".repeat(8)} | A | B | C |

连续长字符串：${"reflecta-storybook-boundary-".repeat(12)}
`;
