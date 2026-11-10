export const SAMPLE_MARKDOWN = `# 在 MDReader 里读一篇文档

> 一份用来检查渲染效果的样例文档：公式、代码、表格、图片，以及一小撮被允许的 HTML。

## 排版与正文

读书时，注意力应该落在文字上。MDReader 把版心、行距、段距都做成了可以调整的变量，你可以把页面调成自己最舒服的样子：加宽一点、把行距放松一点，或者打开首行缩进。

中文标点在这里会被稍微收紧，引号、括号与句末的句号不会把行尾撑开。段间距控制在 \`0.4em\` 到 \`1.6em\` 之间时，长文读起来最不累。

### 行内公式

质能方程 $E = mc^2$ 和勾股定理 $a^2 + b^2 = c^2$ 应该和正文保持同样的基线。下面是一个行间公式：

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

再复杂一点：

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

## 代码

\`\`\`typescript
interface ReaderOptions {
  fontSize: number
  lineHeight: number
  measure: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
\`\`\`

## 表格

| 能力 | 实现 | 状态 |
| --- | --- | --- |
| 公式 | KaTeX | 完成 |
| 图片 | base64 + 相对路径 | 完成 |
| 目录 | 标题锚点 + 滚动同步 | 完成 |
| 搜索 | 文本节点匹配 | 完成 |

## 列表与任务

1. 先打开一份文档
2. 调整字号与版心
3. 用 \`Ctrl+F\` 搜索

- [x] 公式渲染
- [x] 图片灯箱
- [ ] 你自己还想加的东西

## 图片

下面是一张内嵌的 SVG 图片（base64 / data URI 方式）：

![一张内嵌的示意图](data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22720%22%20height%3D%22300%22%20viewBox%3D%220%200%20720%20300%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23dfe9ff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23f7efe0%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22720%22%20height%3D%22300%22%20rx%3D%2214%22%20fill%3D%22url%28%23g%29%22%2F%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%235173b5%22%20stroke-width%3D%222%22%3E%3Ccircle%20cx%3D%22190%22%20cy%3D%22150%22%20r%3D%2244%22%2F%3E%3Ccircle%20cx%3D%22530%22%20cy%3D%22150%22%20r%3D%2244%22%2F%3E%3Cpath%20d%3D%22M234%20150%20H486%22%2F%3E%3Cpath%20d%3D%22M190%20106%20C%20280%2040%2C%20440%2040%2C%20530%20106%22%20stroke-dasharray%3D%225%206%22%2F%3E%3C%2Fg%3E%3Ctext%20x%3D%22190%22%20y%3D%22228%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2217%22%20fill%3D%22%23313b52%22%3Eimage%3C%2Ftext%3E%3Ctext%20x%3D%22530%22%20y%3D%22228%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2217%22%20fill%3D%22%23313b52%22%3Eviewer%3C%2Ftext%3E%3C%2Fsvg%3E)

点击图片可以打开灯箱，滚轮缩放、拖动平移、双击在「适应窗口」与「原始大小」之间切换。

## 一小撮 HTML

<details>
<summary>点开看看被允许的 HTML</summary>

一段被 <mark>高亮</mark> 的文字，一个按键提示 <kbd>Ctrl</kbd> + <kbd>F</kbd>，以及上标 x<sup>2</sup>。

| 标签 | 是否允许 |
| --- | --- |
| details / summary | 是 |
| mark / kbd / sup / sub | 是 |
| script / iframe / style | 否 |

</details>

普通段落里的 <abbr title="Markdown">MD</abbr> 也可以带上注释。

## 脚注

MDReader 支持脚注引用[^1]，以及第二个注脚[^2]。

[^1]: 脚注会在文末统一排版。
[^2]: 这是第二条，用来检查编号与回链。
`
