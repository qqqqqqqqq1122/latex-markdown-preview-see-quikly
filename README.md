# MathLive Markdown and LaTeX Sync
这是一个沉浸式的 Markdown and LaTeX(latex仅支持右边预览左边编辑) 数学公式双向编辑与实时预览插件。

这份代码实现了一个功能非常强大的 VS Code 扩展，名为 **MathLive Sync**。它不仅是一个简单的 Markdown and LaTeX(latex仅支持右边预览左边编辑) 预览器，更像是一个**双向同步的公式编辑器**。

以下是为你准备的详细 README.md 内容，你可以直接在 VS Code 中创建一个 `README.md` 文件并粘贴。

-----

# MathLive Markdown and LaTeX(latex仅支持右边预览左边编辑) Sync - GNN 论文全景预览与双向公式编辑器

**MathLive Markdown and LaTeX(latex仅支持右边预览左边编辑) Sync** 是一款专为科研人员（尤其是 GNN/深度学习方向）设计的 Markdown 编辑辅助工具。它突破了传统“左侧编辑、右侧预览”的死板模式，提供了**所见即所得 (WYSIWYG)** 的公式编辑体验，以及编辑器与预览界面的**深度双向绑定**。

-----

## 🚀 核心功能亮点

### 1\. 实时双向同步 (Two-Way Sync)

  * **从代码到预览**：在 `.md` 文件中输入 LaTeX 公式（支持 `$inline$` 和 `$$block$$`），预览界面会即时渲染。
  * **从预览到代码**：直接在 Webview 预览界面修改文字或点击公式，VS Code 编辑器中的源代码会**同步更新**。

### 2\. 所见即所得的公式编辑 (MathLive Integration)

  * 插件集成了强大的 **MathLive** 库。预览中的公式不再是静态图片，而是**可交互的输入框**。
  * **虚拟键盘支持**：点击公式即可唤起数学符号面板，像使用图形计算器一样编写复杂的 LaTeX 表达式。
  * **自动格式化**：内置 `beautifyLatex` 算法，在回写 `$$
$$
` 块级公式时自动进行缩进和换行美化，让你的源代码整洁如新。
### 3\. 智能焦点追踪 (Focus Tracking)
* 双向定位：
* 在编辑器中移动光标到某个公式，预览界面会自动滚动并将该公式高亮显示。
* 在预览界面点击公式或段落，编辑器会自动跳转到对应的代码行。
* 无痕游标渲染：采用 `\u200B`（零宽空格）标记技术，确保在预览区编辑文字时，光标位置不会因渲染刷新而丢失，提供流畅的打字体验。
### 4\. 专注模式与主题适配
* **护眼主题**：提供精心调教的“纸张色”明亮模式和“深空黑”暗黑模式，保护长时间科研写作的视力。
* **独立渲染**：预览界面拥有独立的样式控制，确保排版美观，适合“全景预览”论文结构。
-----
## 🛠 功能细节说明
### 公式处理逻辑
插件会扫描 Markdown 中的数学模式：
* **行内公式**: `$ E = mc^2 $` -\> 渲染为行内交互组件。
* **块级公式**: `
$$...$$` -\> 渲染为居中的独立编辑块，支持多行美化。

### 交互快捷键/操作

| 动作 | 效果 |
| :--- | :--- |
| **直接输入** | 预览区 `contenteditable` 开启，支持直接修改文本。 |
| **点击公式** | 激活 MathLive 编辑器，同步唤起虚拟键盘。 |
| **Alt + 左键点击** | 将编辑器光标快速定位到当前预览的段落。 |
| **方向键移动** | 离开公式区域时自动触发 LaTeX 闭合渲染。 |
| **🌓 按钮** | 切换预览界面的深色/浅色模式。 |

-----

## 📦 安装与使用

1.  在 VS Code 中打开任意 `.markdown` 或 `.md` 文件。
2.  按下 `F1` 或 `Ctrl+Shift+P` 打开命令面板。
3.  搜索并执行 `MathLive Sync: Hello World`（或自定义的启动命令）。
4.  预览面板将在右侧开启，开始你的高效协作。

-----

## 🏗 技术栈实现

  * **前端渲染**: [Marked.js](https://marked.js.org/) (Markdown 解析), [MathLive](https://www.google.com/search?q=https://cortexjs.io/mathlive/) (公式交互)。
  * **同步引擎**: 基于 `WorkspaceEdit` 实现非破坏性文本替换。
  * **逆向转换**: 使用 [Turndown](https://github.com/mixmark-io/turndown) 将 HTML 预览实时还原为 Markdown 源码。

-----

> **💡 小贴士**:
> 如果你在编写复杂的 GNN 论文（涉及大量矩阵运算和图神经网络公式），建议开启右侧预览。本插件的“公式回写”功能会帮你处理所有的反斜杠转义和格式缩进，你只需要专注于公式本身的数学逻辑。

-----

**希望这个 README 能帮助你更好地展示和使用你的插件！如果需要增加特定的安装步骤（如 npm install 等），请告诉我。**

This code implements a highly powerful VS Code extension named **MathLive Sync**. It is not just a simple Markdown previewer but更像是a **bidirectional synchronized formula editor**. Markdown and LaTeX(latex is only supported with edit in left side) 

Below is the detailed README.md content prepared for you. You can directly create a `README.md` file in VS Code and paste it.

-----

# MathLive Sync - GNN Paper Panoramic Preview and Bidirectional Formula Editor

**MathLive Sync** is a Markdown editing assistant designed specifically for researchers (especially those in GNN/deep learning fields). It breaks away from the rigid "edit on the left, preview on the right" model, offering a **What You See Is What You Get (WYSIWYG)** formula editing experience along with **deep bidirectional binding** between the editor and the preview interface.

-----

## 🚀 Core Features

### 1\. Real-Time Bidirectional Sync

  * **From Code to Preview**: Enter LaTeX formulas in `.md` files (supports `$inline$` and `$$block$$`), and the preview interface renders them instantly.
  * **From Preview to Code**: Modify text or click on formulas directly in the Webview preview, and the source code in the VS Code editor **updates synchronously**.

### 2\. WYSIWYG Formula Editing (MathLive Integration)

  * The plugin integrates the powerful **MathLive** library. Formulas in the preview are no longer static images but **interactive input fields**.
  * **Virtual Keyboard Support**: Click on a formula to bring up a math symbol panel, allowing you to write complex LaTeX expressions just like using a graphing calculator.
  * **Auto-formatting**: Includes a built-in `beautifyLatex` algorithm that automatically indents and formats `$$
$$` block-level formulas when writing back, keeping your source code clean and tidy.
### 3\. Intelligent Focus Tracking
* **Bidirectional Positioning**:
* Move the cursor to a formula in the editor, and the preview interface will automatically scroll and highlight that formula.
* Click on a formula or paragraph in the preview, and the editor will automatically jump to the corresponding line of code.
* **Seamless Cursor Rendering**: Utilizes `\u200B` (zero-width space) marker technology to ensure that when editing text in the preview area, the cursor position is not lost due to rendering refreshes, providing a smooth typing experience.
### 4\. Focus Mode and Theme Adaptation
* **Eye-Friendly Themes**: Offers carefully tuned "Paper Color" light mode and "Deep Space Black" dark mode to protect your eyes during long research writing sessions.
* **Independent Rendering**: The preview interface has independent style control, ensuring beautiful typesetting suitable for a "panoramic preview" of your paper's structure.
-----
## 🛠 Feature Details
### Formula Processing Logic
The plugin scans mathematical patterns in Markdown:
* **Inline Formulas**: `$ E = mc^2 $` -> Rendered as inline interactive components.
* **Block-Level Formulas**: `
$$...$$` -> Rendered as centered, independent editing blocks, supporting multi-line beautification.

### Interactive Shortcuts/Actions

| Action | Effect |
| :--- | :--- |
| **Direct Input** | The preview area is `contenteditable`, allowing direct text modification. |
| **Click Formula** | Activates the MathLive editor and simultaneously brings up the virtual keyboard. |
| **Alt + Left Click** | Quickly positions the editor cursor to the current paragraph in the preview. |
| **Arrow Key Movement** | Automatically triggers LaTeX closing rendering when leaving the formula area. |
| **🌓 Button** | Toggles the dark/light mode of the preview interface. |

-----

## 📦 Installation and Usage

1.  Open any `.markdown` or `.md` file in VS Code.
2.  Press `F1` or `Ctrl+Shift+P` to open the command palette.
3.  Search for and execute `MathLive Sync: Hello World` (or your custom launch command).
4.  The preview panel will open on the right, and you can start your efficient collaboration.

-----

## 🏗 Technology Stack

  * **Frontend Rendering**: [Marked.js](https://marked.js.org/) (Markdown parsing), [MathLive](https://cortexjs.io/mathlive/) (Formula interaction).
  * **Sync Engine**: Uses `WorkspaceEdit` for non-destructive text replacement.
  * **Reverse Conversion**: Uses [Turndown](https://github.com/mixmark-io/turndown) to revert HTML previews to Markdown source code in real-time.

-----

> **💡 Tip**:
> If you are writing complex GNN papers (involving a large number of matrix operations and graph neural network formulas), it is recommended to keep the right-side preview open. The plugin's "formula write-back" feature will handle all backslash escaping and formatting indentation for you, allowing you to focus solely on the mathematical logic of the formulas themselves.

-----

**I hope this README helps you better showcase and utilize your plugin! If you need to add specific installation steps (such as npm install, etc.), please let me know.**