# H1 一级标题

## H2 二级标题

### H3 三级标题

#### H4 四级标题

##### H5 五级标题

###### H6 六级标题

---

## 文字样式

普通文本正常显示。

**粗体文字** 和 **也是粗体**

_斜体文字_ 和 _也是斜体_

**_粗斜体文字_** 和 **_也是粗斜体_**

~~删除线文字~~

`行内代码 inline code`

> 这是一段引用文字（Blockquote）
> 可以多行连续引用

> 嵌套引用第一层
>
> > 嵌套引用第二层
> >
> > > 嵌套引用第三层

---

## 列表

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

### 任务列表（Task List）

- [x] 已完成任务
- [x] 另一个已完成任务
- [ ] 未完成任务
- [ ] 待办事项

---

## 链接与图片

### 链接

[普通链接](https://www.example.com)

[带 title 的链接](https://www.example.com "悬停提示文字")

<https://www.example.com> （自动链接）

[引用式链接][ref-link]

[ref-link]: https://www.example.com "引用链接的 title"

### 图片

![替代文字](https://picsum.photos/400/200 "图片 title")

[![可点击的图片](https://picsum.photos/200/100)](https://www.example.com)

---

## 代码块

### 行内代码

使用 `console.log("Hello World")` 打印输出。

### 围栏代码块（带语言高亮）

```javascript
// JavaScript 示例
function greet(name) {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}

greet("World");
```

```python
# Python 示例
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print([fibonacci(i) for i in range(10)])
```

```css
/* CSS 示例 */
.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #f0f0f0;
  padding: 16px;
  border-radius: 8px;
}
```

```json
{
  "name": "markdown-test",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "start": "node index.js",
    "build": "tsc"
  }
}
```

```bash
# Shell 命令示例
echo "Hello, World!"
git clone https://github.com/example/repo.git
cd repo && npm install && npm start
```

---

## 表格

### 基础表格

| 姓名 | 年龄 | 职业     |
| ---- | ---- | -------- |
| 张三 | 28   | 工程师   |
| 李四 | 34   | 设计师   |
| 王五 | 25   | 产品经理 |

### 对齐方式

| 左对齐   | 居中对齐 |   右对齐 |
| :------- | :------: | -------: |
| 左边内容 | 中间内容 | 右边内容 |
| Left     |  Center  |    Right |
| 100      |   200    |      300 |

---

## 分隔线

三种写法，效果相同：

---

---

---

---

## 转义字符

使用反斜杠 `\` 转义特殊字符：

\*不是斜体\* \*\*不是粗体\*\* \`不是代码\`

\# 不是标题 \- 不是列表 \> 不是引用

---

## 数学公式（LaTeX，部分编辑器支持）

### 行内公式

质能方程：$$E = mc^2$$，欧拉公式：$$e^{i\pi} + 1 = 0$$

### 块级公式

$$
\int_{-\infty}^{+\infty} e^{-x^2} dx = \sqrt{\pi}
$$

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
\begin{pmatrix}
x \\
y
\end{pmatrix}
=
\begin{pmatrix}
ax + by \\
cx + dy
\end{pmatrix}
$$

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n
$$

---

## 脚注（部分编辑器支持）

这是一段带有脚注的文字[^1]，这里还有另一个脚注[^note]。

[^1]: 这是第一个脚注的内容。

[^note]: 这是命名脚注的内容，支持**Markdown**格式。

---

## 定义列表（部分编辑器支持）

Markdown
: 一种轻量级标记语言

HTML
: 超文本标记语言
: 用于构建网页结构

---

## 综合嵌套示例

> ### 引用中的标题
>
> 引用块内可以包含其他 Markdown 元素：
>
> - **粗体列表项**
> - _斜体列表项_
> - `代码列表项`
>
> ```python
> # 引用中的代码块
> print("Hello from blockquote!")
> ```
>
> | 表格列A | 表格列B |
> | ------- | ------- |
> | 引用中  | 的表格  |

---

_文档结束 · Markdown 全语法测试完毕_ 🎉
