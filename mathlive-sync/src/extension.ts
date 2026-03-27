// import * as vscode from 'vscode';

// type IndexedMathMatch = {
//     index: number;
//     fullText: string;
//     innerText: string;
//     start: number;
//     end: number;
//     isBlock: boolean;
//     isMultilineBlock: boolean;
//     documentUri: vscode.Uri;
// };

// export function activate(context: vscode.ExtensionContext) {
//     let currentPanel: vscode.WebviewPanel | undefined;
//     let boundEditor: vscode.TextEditor | undefined;
//     let isApplyingFromWebview = false;
//     let isSyncingFocus = false; 

//     let lastStructText = '';
//     let lastMatches: IndexedMathMatch[] = [];

//     context.subscriptions.push(
//         vscode.commands.registerCommand('mathlive-sync.helloWorld', () => {
//             renderEditor(vscode.window.activeTextEditor, true); 
//         })
//     );

//     function getMathMatches(text: string, documentUri: vscode.Uri): IndexedMathMatch[] {
//         const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
//         const matches: IndexedMathMatch[] = [];

//         let match: RegExpExecArray | null;
//         let idx = 0;

//         while ((match = regex.exec(text)) !== null) {
//             const fullText = match[0];
//             const isBlock = fullText.startsWith('$$');
//             const innerText = isBlock ? fullText.slice(2, -2) : fullText.slice(1, -1);

//             matches.push({
//                 index: idx,
//                 fullText,
//                 innerText: innerText,
//                 start: match.index,
//                 end: match.index + fullText.length,
//                 isBlock,
//                 isMultilineBlock: isBlock && fullText.includes('\n'),
//                 documentUri
//             });

//             idx++;
//         }
//         return matches;
//     }

//     function getStructuralText(text: string, matches: IndexedMathMatch[]) {
//         let res = '';
//         let lastEnd = 0;
//         for (let i = 0; i < matches.length; i++) {
//             res += text.slice(lastEnd, matches[i].start) + `%%%MATH_${i}%%%`;
//             lastEnd = matches[i].end;
//         }
//         res += text.slice(lastEnd);
//         return res;
//     }

//     function renderEditor(editor: vscode.TextEditor | undefined, forceFull = false) {
//         if (!editor || editor.document.languageId !== 'markdown') return;

//         boundEditor = editor;
//         ensurePanel();

//         const text = editor.document.getText();
//         const matches = getMathMatches(text, editor.document.uri);
//         const structText = getStructuralText(text, matches);

//         if (!forceFull && currentPanel && structText === lastStructText && matches.length === lastMatches.length) {
//             const changes = [];
//             for (let i = 0; i < matches.length; i++) {
//                 if (matches[i].innerText !== lastMatches[i].innerText) {
//                     changes.push({ index: i, latex: matches[i].innerText });
//                 }
//             }
//             if (changes.length > 0) {
//                 currentPanel.webview.postMessage({ command: 'updateMathOnly', changes });
//             }
//             lastMatches = matches;
//             return;
//         }

//         lastStructText = structText;
//         lastMatches = matches;
//         currentPanel?.webview.postMessage({ command: 'renderFull', text });
//     }

//     function ensurePanel() {
//         if (currentPanel) return;

//         currentPanel = vscode.window.createWebviewPanel(
//             'mathLive', 'GNN 论文全景预览',
//             { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
//             { enableScripts: true, retainContextWhenHidden: true }
//         );

//         currentPanel.webview.html = getWebviewContent();

//         currentPanel.webview.onDidReceiveMessage(async (message) => {
//             if (message.command === 'focusEditor') {
//                 const editor = boundEditor;
//                 if (!editor) return;
                
//                 const matches = getMathMatches(editor.document.getText(), editor.document.uri);
//                 const target = matches[Number(message.index)];
                
//                 if (target) {
//                     isSyncingFocus = true; 
//                     const delimiterLen = target.isBlock ? 2 : 1;
//                     const pos = editor.document.positionAt(target.start + delimiterLen);
//                     editor.selection = new vscode.Selection(pos, pos);
//                     editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
//                     setTimeout(() => { isSyncingFocus = false; }, 100); 
//                 }
//                 return;
//             }

//             if (message.command === 'syncTextToEditor') {
//                 const editor = boundEditor;
//                 if (!editor) return;

//                 const searchStr = String(message.text).trim();
//                 if (!searchStr) return;

//                 const docText = editor.document.getText();
//                 let idx = docText.indexOf(searchStr);
//                 if (idx === -1) {
//                     const snippet = searchStr.substring(0, 15);
//                     idx = docText.indexOf(snippet);
//                 }

//                 if (idx >= 0) {
//                     isSyncingFocus = true; 
//                     const pos = editor.document.positionAt(idx);
//                     editor.selection = new vscode.Selection(pos, pos);
//                     editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
//                     setTimeout(() => { isSyncingFocus = false; }, 100); 
//                 }
//                 return;
//             }

//             if (message.command === 'editFullText') {
//                 const editor = boundEditor;
//                 if (!editor) return;

//                 const fullRange = new vscode.Range(
//                     editor.document.positionAt(0),
//                     editor.document.positionAt(editor.document.getText().length)
//                 );

//                 const edit = new vscode.WorkspaceEdit();
//                 edit.replace(editor.document.uri, fullRange, String(message.text));

//                 isApplyingFromWebview = true;
//                 const ok = await vscode.workspace.applyEdit(edit);
//                 isApplyingFromWebview = false;

//                 if (!ok) {
//                     vscode.window.showWarningMessage('文本回写失败');
//                 }
//                 return;
//             }

//             if (message.command !== 'editMath') return;

//             const editor = boundEditor;
//             if (!editor) return;

//             const text = editor.document.getText();
//             const matches = getMathMatches(text, editor.document.uri);
//             const target = matches[Number(message.index)];

//             if (!target) return;

//             let newLatex = String(message.latex ?? '').trim();
//             const replacement = target.isBlock ? `$$\n${newLatex}\n$$` : `$${newLatex}$`;

//             const startPos = editor.document.positionAt(target.start);
//             const endPos = editor.document.positionAt(target.end);

//             const edit = new vscode.WorkspaceEdit();
//             edit.replace(target.documentUri, new vscode.Range(startPos, endPos), replacement);

//             isApplyingFromWebview = true;
//             const ok = await vscode.workspace.applyEdit(edit);
//             isApplyingFromWebview = false;

//             if (!ok) {
//                 vscode.window.showWarningMessage('公式回写失败');
//             }
//         });

//         currentPanel.onDidDispose(() => {
//             currentPanel = undefined;
//             boundEditor = undefined;
//         });
//     }

//     context.subscriptions.push(
//         vscode.workspace.onDidChangeTextDocument((e) => {
//             const editor = boundEditor;
//             if (!editor || !currentPanel || e.document.uri.toString() !== editor.document.uri.toString()) {
//                 return;
//             }

//             if (isApplyingFromWebview) {
//                 const text = editor.document.getText();
//                 const matches = getMathMatches(text, editor.document.uri);
//                 lastStructText = getStructuralText(text, matches);
//                 lastMatches = matches;
//                 return;
//             }

//             renderEditor(editor, false);
//         })
//     );

//     context.subscriptions.push(
//         vscode.window.onDidChangeActiveTextEditor((editor) => {
//             renderEditor(editor, true);
//         })
//     );

//     context.subscriptions.push(
//         vscode.window.onDidChangeTextEditorSelection((event) => {
//             if (event.textEditor.document.languageId === 'markdown') {
//                 boundEditor = event.textEditor;

//                 if (isSyncingFocus || !currentPanel) return;

//                 const offset = event.textEditor.document.offsetAt(event.selections[0].active);
//                 const text = event.textEditor.document.getText();
//                 const matches = getMathMatches(text, event.textEditor.document.uri);
                
//                 const target = matches.find(m => {
//                     const delimiterLen = m.isBlock ? 2 : 1;
//                     return offset >= m.start + delimiterLen && offset <= m.end - delimiterLen;
//                 });
//                 if (target) {
//                     currentPanel.webview.postMessage({
//                         command: 'focusMath',
//                         index: target.index
//                     });
//                 } else {
//                     currentPanel.webview.postMessage({ command: 'blurMath' });
                    
//                     const activeLineStr = event.textEditor.document.lineAt(event.selections[0].active.line).text.trim();
//                     if (activeLineStr) {
//                         currentPanel.webview.postMessage({
//                             command: 'syncPreviewToEditor',
//                             text: activeLineStr
//                         });
//                     }
//                 }
//             }
//         })
//     );

//     if (vscode.window.activeTextEditor?.document.languageId === 'markdown') {
//         renderEditor(vscode.window.activeTextEditor, true);
//     }
// }

// function getWebviewContent() {
//     return `<!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
//     <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
//     <script type="module" src="https://unpkg.com/mathlive?module"></script>
//     <style>
//         /* 定义双主题色板 */
//         :root {
//             --bg-color: #f6f0df;
//             --text-color: #333333;
//             --h-color: #1a1a1a;
//             --border-color: #eaeaea;
//             --bq-bg: #f9f9f9;
//             --bq-text: #555;
//             --code-bg: #f0f0f0;
//             --code-text: #d14;
//             --math-text: #000000;
//             --math-focus-bg: #fcfcfc;
//             --scrollbar-bg: #ccc;
//         }

//         body.dark-mode {
//             --bg-color: #181818;
//             --text-color: #f0f0f0;
//             --h-color: #ffffff;
//             --border-color: #444444;
//             --bq-bg: #2d2d2d;
//             --bq-text: #aaaaaa;
//             --code-bg: #2d2d2d;
//             --code-text: #ce9178;
//             --math-text: #f0f0f0;
//             --math-focus-bg: #2d2d2d;
//             --scrollbar-bg: #555555;
//         }

//         body { 
//             background: var(--bg-color); color: var(--text-color); padding: 30px 50px; 
//             font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; 
//             line-height: 1.4; font-size: 16px; transition: background 0.3s, color 0.3s; 
//         }
//         h1, h2, h3 { color: var(--h-color); border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-top: 20px; text-indent: 0; }
//         blockquote { border-left: 4px solid #007acc; background-color: var(--bq-bg); padding: 10px 15px; margin: 15px 0; color: var(--bq-text); border-radius: 0 4px 4px 0; text-indent: 0; }
//         code { background: var(--code-bg); padding: 3px 6px; border-radius: 4px; color: var(--code-text); font-family: Consolas, monospace; font-size: 0.9em; text-indent: 0; }
        
//         #preview p { text-indent: 2em; margin: 0.5em 0; }
//         #preview { outline: none; }

//         span.math-wrapper.inline-math { display: inline; text-indent: 0; }
        
//         math-field { 
//             border-radius: 4px; background: transparent; color: var(--math-text); box-sizing: border-box; border: none; 
//             outline: 1px solid transparent; padding: 0; margin: 0; font-size: 1em; min-height: 0 !important; 
//             vertical-align: middle; margin: -0.2em 0.1em; display: inline-block; transition: color 0.3s;
//         }

//         math-field::part(menu-toggle),
//         math-field::part(virtual-keyboard-toggle) { display: none; }

//         math-field:focus-within { outline: 1px solid #8ab4f8; background: var(--math-focus-bg); box-shadow: 0 0 5px rgba(138, 180, 248, 0.4); margin: 0 2px; }
//         math-field:focus-within::part(menu-toggle),
//         math-field:focus-within::part(virtual-keyboard-toggle) { display: flex; }

//         math-field.active-math { background: #e3f2fd; outline: 1px solid #2196f3; box-shadow: 0 0 8px rgba(33, 150, 243, 0.4); color: #000; }

//         span.math-wrapper.block-math { 
//             display: block; width: 100%; margin: 15px 0; overflow-x: auto; overflow-y: hidden; 
//             text-align: center; padding: 10px 0; text-indent: 0; 
//         }
        
//         span.math-wrapper.block-math math-field { display: inline-block; padding: 8px 15px; min-width: min-content; max-width: none; margin: 0; }

//         span.math-wrapper.block-math::-webkit-scrollbar { height: 6px; }
//         span.math-wrapper.block-math::-webkit-scrollbar-thumb { background-color: var(--scrollbar-bg); border-radius: 4px; }

//         /* 悬浮切换按钮 */
//         #theme-btn {
//             position: fixed; bottom: 30px; right: 30px; width: 45px; height: 45px; border-radius: 50%;
//             background: var(--text-color); color: var(--bg-color); border: none; cursor: pointer;
//             box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 20px; display: flex; align-items: center; justify-content: center;
//             transition: transform 0.2s, background 0.3s, color 0.3s; z-index: 9999; user-select: none;
//         }
//         #theme-btn:hover { transform: scale(1.1); }
//     </style>
// </head>
// <body>
//     <div id="preview" contenteditable="true"></div>
//     <button id="theme-btn" title="切换专注模式">🌓</button>

//     <script>
//         const vscode = acquireVsCodeApi();
//         const preview = document.getElementById('preview');

//         // 主题切换
//         const themeBtn = document.getElementById('theme-btn');
//         if (localStorage.getItem('mathlive-theme') === 'dark') {
//             document.body.classList.add('dark-mode');
//         }
//         themeBtn.addEventListener('click', () => {
//             document.body.classList.toggle('dark-mode');
//             localStorage.setItem('mathlive-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
//         });

//         function beautifyLatex(latex) {
//             if (!latex) return '';
//             let step1 = latex
//                 .replace(/\\\\\\\\/g, '\\\\\\\\\\n    ') 
//                 .replace(/(\\\\begin{[^}]+}(?:{[^}]+})?)/g, '\\n$1\\n')
//                 .replace(/(\\\\end{[^}]+})/g, '\\n$1\\n')
//                 .replace(/(\\\\left(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n')
//                 .replace(/(\\\\right(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n');

//             let lines = step1.split('\\n').map(l => l.trim()).filter(l => l);
//             let result = [];
//             let indent = 0;

//             for (let i = 0; i < lines.length; i++) {
//                 let line = lines[i];
//                 if (line.match(/^\\\\end{/) || line.match(/^\\\\right/)) {
//                     indent = Math.max(0, indent - 1);
//                 }
//                 result.push('    '.repeat(indent) + line);
//                 if (line.match(/^\\\\begin{/) || line.match(/^\\\\left/)) {
//                     indent++;
//                 }
//             }

//             let finalStr = result.join('\\n');
//             finalStr = finalStr.replace(/([^\\n]+)\\n\\s*(\\\\left)/g, '$1 $2');
//             finalStr = finalStr.replace(/(\\\\right[^\\n]+)\\n\\s*(\\\\tag)/g, '$1 $2');
            
//             return finalStr;
//         }

//         const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        
//         turndownService.escape = function (string) { return string; };

//         turndownService.addRule('mathWrapper', {
//             filter: function (node, options) {
//                 return node.nodeName === 'SPAN' && node.classList.contains('math-wrapper');
//             },
//             replacement: function (content, node) {
//                 const mfClone = node.querySelector('math-field');
//                 if (!mfClone) return '';
//                 const index = mfClone.getAttribute('data-index');
                
//                 const realMf = document.querySelector(\`math-field[data-index="\${index}"]\`);
//                 const isBlock = node.classList.contains('block-math');

//                 if (realMf && realMf.hasAttribute('data-dirty')) {
//                     let latex = realMf.getValue();
//                     if (isBlock) {
//                         latex = beautifyLatex(latex); 
//                     }
//                     return isBlock ? \`\\n\\n$$\\n\${latex}\\n$$\\n\\n\` : \`$\${latex}$\`;
//                 } else {
//                     const rawLatex = decodeURIComponent(node.getAttribute('data-raw'));
//                     return isBlock ? \`$$\${rawLatex}$$\` : \`$\${rawLatex}$\`;
//                 }
//             }
//         });

//         let scrollSyncTimer;

//         window.addEventListener('message', event => {
//             if (event.data.command === 'renderFull') {
//                 renderMarkdown(event.data.text);
//             }
            
//             if (event.data.command === 'updateMathOnly') {
//                 event.data.changes.forEach(change => {
//                     const mf = document.querySelector(\`math-field[data-index="\${change.index}"]\`);
//                     if (mf && mf.getValue() !== change.latex) {
//                         mf.setValue(change.latex, { suppressChangeNotifications: true });
//                         mf.removeAttribute('data-dirty');
//                         const wrapper = mf.closest('.math-wrapper');
//                         if (wrapper) {
//                             wrapper.setAttribute('data-raw', encodeURIComponent(change.latex));
//                         }
//                     }
//                 });
//             }

//             if (event.data.command === 'focusMath') {
//                 document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//                 const mf = document.querySelector(\`math-field[data-index="\${event.data.index}"]\`);
//                 if (mf) {
//                     mf.classList.add('active-math');
//                     const rect = mf.getBoundingClientRect();
//                     if(rect.top < 0 || rect.bottom > window.innerHeight) {
//                         mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                     }
//                 }
//             }

//             if (event.data.command === 'blurMath') {
//                 document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//             }

//             if (event.data.command === 'syncPreviewToEditor') {
//                 clearTimeout(scrollSyncTimer);
//                 scrollSyncTimer = setTimeout(() => {
//                     const cleanSearch = event.data.text.replace(/[#\\*\\->\\s\\$\`_\\[\\]\\(\\)]/g, '');
//                     if (cleanSearch.length < 2) return;

//                     const snippet = cleanSearch.substring(0, 20);

//                     const elements = preview.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
//                     for (let el of elements) {
//                         const cleanElText = (el.textContent || '').replace(/\\s/g, '');
//                         if (!cleanElText) continue;

//                         if (cleanElText.includes(snippet)) {
//                             const rect = el.getBoundingClientRect();
//                             if(rect.top < 0 || rect.bottom > window.innerHeight) {
//                                 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                             }
                            
//                             // 【去除干扰】：完全删除了闪烁蓝色高亮，仅做无感平滑滚动定位
//                             break;
//                         }
//                     }
//                 }, 100); 
//             }
//         });

//         let textEditTimer;
//         preview.addEventListener('input', (e) => {
//             if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;

//             clearTimeout(textEditTimer);
//             textEditTimer = setTimeout(() => {
//                 const markdownText = turndownService.turndown(preview);
//                 vscode.postMessage({
//                     command: 'editFullText',
//                     text: markdownText
//                 });
//             }, 400); 
//         });

//         // 粘贴自动渲染公式
//         preview.addEventListener('paste', () => {
//             setTimeout(() => {
//                 const markdownText = turndownService.turndown(preview);
//                 renderMarkdown(markdownText);
//             }, 50);
//         });

//         // 失去焦点自动渲染公式
//         preview.addEventListener('focusout', (e) => {
//             if (preview.contains(e.relatedTarget)) return;
//             const markdownText = turndownService.turndown(preview);
//             renderMarkdown(markdownText);
//         });

//         preview.addEventListener('click', (e) => {
//             if (e.altKey) {
//                 if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;
                
//                 const block = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
//                 if (block) {
//                     const mdText = turndownService.turndown(block).trim();
//                     vscode.postMessage({
//                         command: 'syncTextToEditor',
//                         text: mdText
//                     });
//                 }
//             }
//         });

//         function renderMarkdown(text) {
//             const mathBlocks = [];

//             const tempText = text.replace(/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$)/g, (match) => {
//                 const isBlock = match.startsWith('$$');
//                 const inner = isBlock ? match.slice(2, -2) : match.slice(1, -1);
//                 mathBlocks.push({ isBlock, inner: inner }); 
//                 return \`%%%MATH_\${mathBlocks.length - 1}%%%\`;
//             });

//             let html = marked.parse(tempText);

//             html = html.replace(/%%%MATH_(\\d+)%%%/g, (_match, p1) => {
//                 const index = parseInt(p1, 10);
//                 const block = mathBlocks[index];
//                 const cls = block.isBlock ? 'block-math' : 'inline-math';

//                 const escapedInner = block.inner.replace(/\\s+/g, ' ')
//                     .replace(/&/g, '&amp;')
//                     .replace(/</g, '&lt;')
//                     .replace(/>/g, '&gt;');

//                 const encodedRaw = encodeURIComponent(block.inner);

//                 return \`<span contenteditable="false" class="math-wrapper \${cls}" data-raw="\${encodedRaw}"><math-field data-index="\${index}" virtual-keyboard-mode="onfocus">\${escapedInner}</math-field></span>\`;
//             });

//             preview.innerHTML = html;

//             preview.querySelectorAll('math-field').forEach((mf) => {
//                 const send = () => {
//                     mf.setAttribute('data-dirty', 'true');
                    
//                     let latex = mf.getValue();
//                     const isBlock = mf.closest('.math-wrapper').classList.contains('block-math');
                    
//                     if (isBlock) {
//                         latex = beautifyLatex(latex);
//                     }
                    
//                     vscode.postMessage({
//                         command: 'editMath',
//                         index: Number(mf.dataset.index),
//                         latex: latex
//                     });
//                 };

//                 mf.addEventListener('input', send);
    
//                 mf.addEventListener('focusin', () => {
//                     document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//                     vscode.postMessage({
//                         command: 'focusEditor',
//                         index: Number(mf.dataset.index)
//                     });
//                 });
//             });
//         }
//     </script>
// </body>
// </html>`;
// }
// import * as vscode from 'vscode';

// type IndexedMathMatch = {
//     index: number;
//     fullText: string;
//     innerText: string;
//     start: number;
//     end: number;
//     isBlock: boolean;
//     isMultilineBlock: boolean;
//     documentUri: vscode.Uri;
// };

// export function activate(context: vscode.ExtensionContext) {
//     let currentPanel: vscode.WebviewPanel | undefined;
//     let boundEditor: vscode.TextEditor | undefined;
//     let isApplyingFromWebview = false;
//     let isSyncingFocus = false; 

//     let lastStructText = '';
//     let lastMatches: IndexedMathMatch[] = [];

//     context.subscriptions.push(
//         vscode.commands.registerCommand('mathlive-sync.helloWorld', () => {
//             renderEditor(vscode.window.activeTextEditor, true); 
//         })
//     );

//     function getMathMatches(text: string, documentUri: vscode.Uri): IndexedMathMatch[] {
//         const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
//         const matches: IndexedMathMatch[] = [];

//         let match: RegExpExecArray | null;
//         let idx = 0;

//         while ((match = regex.exec(text)) !== null) {
//             const fullText = match[0];
//             const isBlock = fullText.startsWith('$$');
//             const innerText = isBlock ? fullText.slice(2, -2) : fullText.slice(1, -1);

//             matches.push({
//                 index: idx,
//                 fullText,
//                 innerText: innerText,
//                 start: match.index,
//                 end: match.index + fullText.length,
//                 isBlock,
//                 isMultilineBlock: isBlock && fullText.includes('\n'),
//                 documentUri
//             });

//             idx++;
//         }
//         return matches;
//     }

//     function getStructuralText(text: string, matches: IndexedMathMatch[]) {
//         let res = '';
//         let lastEnd = 0;
//         for (let i = 0; i < matches.length; i++) {
//             res += text.slice(lastEnd, matches[i].start) + `%%%MATH_${i}%%%`;
//             lastEnd = matches[i].end;
//         }
//         res += text.slice(lastEnd);
//         return res;
//     }

//     function renderEditor(editor: vscode.TextEditor | undefined, forceFull = false) {
//         if (!editor || editor.document.languageId !== 'markdown') return;

//         boundEditor = editor;
//         ensurePanel();

//         const text = editor.document.getText();
//         const matches = getMathMatches(text, editor.document.uri);
//         const structText = getStructuralText(text, matches);

//         if (!forceFull && currentPanel && structText === lastStructText && matches.length === lastMatches.length) {
//             const changes = [];
//             for (let i = 0; i < matches.length; i++) {
//                 if (matches[i].innerText !== lastMatches[i].innerText) {
//                     changes.push({ index: i, latex: matches[i].innerText });
//                 }
//             }
//             if (changes.length > 0) {
//                 currentPanel.webview.postMessage({ command: 'updateMathOnly', changes });
//             }
//             lastMatches = matches;
//             return;
//         }

//         lastStructText = structText;
//         lastMatches = matches;
//         currentPanel?.webview.postMessage({ command: 'renderFull', text });
//     }

//     function ensurePanel() {
//         if (currentPanel) return;

//         currentPanel = vscode.window.createWebviewPanel(
//             'mathLive', 'GNN 论文全景预览',
//             { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
//             { enableScripts: true, retainContextWhenHidden: true }
//         );

//         currentPanel.webview.html = getWebviewContent();

//         currentPanel.webview.onDidReceiveMessage(async (message) => {
//             if (message.command === 'focusEditor') {
//                 const editor = boundEditor;
//                 if (!editor) return;
                
//                 const matches = getMathMatches(editor.document.getText(), editor.document.uri);
//                 const target = matches[Number(message.index)];
                
//                 if (target) {
//                     isSyncingFocus = true; 
//                     const delimiterLen = target.isBlock ? 2 : 1;
//                     const pos = editor.document.positionAt(target.start + delimiterLen);
//                     editor.selection = new vscode.Selection(pos, pos);
//                     editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
//                     setTimeout(() => { isSyncingFocus = false; }, 100); 
//                 }
//                 return;
//             }

//             if (message.command === 'syncTextToEditor') {
//                 const editor = boundEditor;
//                 if (!editor) return;

//                 const searchStr = String(message.text).trim();
//                 if (!searchStr) return;

//                 const docText = editor.document.getText();
//                 let idx = docText.indexOf(searchStr);
//                 if (idx === -1) {
//                     const snippet = searchStr.substring(0, 15);
//                     idx = docText.indexOf(snippet);
//                 }

//                 if (idx >= 0) {
//                     isSyncingFocus = true; 
//                     const pos = editor.document.positionAt(idx);
//                     editor.selection = new vscode.Selection(pos, pos);
//                     editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
//                     setTimeout(() => { isSyncingFocus = false; }, 100); 
//                 }
//                 return;
//             }

//             if (message.command === 'editFullText') {
//                 const editor = boundEditor;
//                 if (!editor) return;

//                 const fullRange = new vscode.Range(
//                     editor.document.positionAt(0),
//                     editor.document.positionAt(editor.document.getText().length)
//                 );

//                 const edit = new vscode.WorkspaceEdit();
//                 edit.replace(editor.document.uri, fullRange, String(message.text));

//                 isApplyingFromWebview = true;
//                 const ok = await vscode.workspace.applyEdit(edit);
//                 isApplyingFromWebview = false;

//                 if (!ok) {
//                     vscode.window.showWarningMessage('文本回写失败');
//                 }
//                 return;
//             }

//             if (message.command !== 'editMath') return;

//             const editor = boundEditor;
//             if (!editor) return;

//             const text = editor.document.getText();
//             const matches = getMathMatches(text, editor.document.uri);
//             const target = matches[Number(message.index)];

//             if (!target) return;

//             let newLatex = String(message.latex ?? '').trim();
//             const replacement = target.isBlock ? `$$\n${newLatex}\n$$` : `$${newLatex}$`;

//             const startPos = editor.document.positionAt(target.start);
//             const endPos = editor.document.positionAt(target.end);

//             const edit = new vscode.WorkspaceEdit();
//             edit.replace(target.documentUri, new vscode.Range(startPos, endPos), replacement);

//             isApplyingFromWebview = true;
//             const ok = await vscode.workspace.applyEdit(edit);
//             isApplyingFromWebview = false;

//             if (!ok) {
//                 vscode.window.showWarningMessage('公式回写失败');
//             }
//         });

//         currentPanel.onDidDispose(() => {
//             currentPanel = undefined;
//             boundEditor = undefined;
//         });
//     }

//     context.subscriptions.push(
//         vscode.workspace.onDidChangeTextDocument((e) => {
//             const editor = boundEditor;
//             if (!editor || !currentPanel || e.document.uri.toString() !== editor.document.uri.toString()) {
//                 return;
//             }

//             if (isApplyingFromWebview) {
//                 const text = editor.document.getText();
//                 const matches = getMathMatches(text, editor.document.uri);
//                 lastStructText = getStructuralText(text, matches);
//                 lastMatches = matches;
//                 return;
//             }

//             renderEditor(editor, false);
//         })
//     );

//     context.subscriptions.push(
//         vscode.window.onDidChangeActiveTextEditor((editor) => {
//             renderEditor(editor, true);
//         })
//     );

//     context.subscriptions.push(
//         vscode.window.onDidChangeTextEditorSelection((event) => {
//             if (event.textEditor.document.languageId === 'markdown') {
//                 boundEditor = event.textEditor;

//                 if (isSyncingFocus || !currentPanel) return;

//                 const offset = event.textEditor.document.offsetAt(event.selections[0].active);
//                 const text = event.textEditor.document.getText();
//                 const matches = getMathMatches(text, event.textEditor.document.uri);
                
//                 const target = matches.find(m => {
//                     const delimiterLen = m.isBlock ? 2 : 1;
//                     return offset >= m.start + delimiterLen && offset <= m.end - delimiterLen;
//                 });
//                 if (target) {
//                     currentPanel.webview.postMessage({
//                         command: 'focusMath',
//                         index: target.index
//                     });
//                 } else {
//                     currentPanel.webview.postMessage({ command: 'blurMath' });
                    
//                     const activeLineStr = event.textEditor.document.lineAt(event.selections[0].active.line).text.trim();
//                     if (activeLineStr) {
//                         currentPanel.webview.postMessage({
//                             command: 'syncPreviewToEditor',
//                             text: activeLineStr
//                         });
//                     }
//                 }
//             }
//         })
//     );

//     if (vscode.window.activeTextEditor?.document.languageId === 'markdown') {
//         renderEditor(vscode.window.activeTextEditor, true);
//     }
// }

// function getWebviewContent() {
//     return `<!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
//     <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
//     <script type="module" src="https://unpkg.com/mathlive?module"></script>
//     <style>
//         :root {
//             --bg-color: #f6f0df;
//             --text-color: #333333;
//             --h-color: #1a1a1a;
//             --border-color: #eaeaea;
//             --bq-bg: #f9f9f9;
//             --bq-text: #555;
//             --code-bg: #f0f0f0;
//             --code-text: #d14;
//             --math-text: #000000;
//             --math-focus-bg: #fcfcfc;
//             --scrollbar-bg: #ccc;
//         }

//         body.dark-mode {
//             --bg-color: #181818;
//             --text-color: #f0f0f0;
//             --h-color: #ffffff;
//             --border-color: #444444;
//             --bq-bg: #2d2d2d;
//             --bq-text: #aaaaaa;
//             --code-bg: #2d2d2d;
//             --code-text: #ce9178;
//             --math-text: #f0f0f0;
//             --math-focus-bg: #2d2d2d;
//             --scrollbar-bg: #555555;
//         }

//         body { 
//             background: var(--bg-color); color: var(--text-color); margin: 0; padding: 0; 
//             font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; 
//             line-height: 1.4; font-size: 16px; transition: background 0.3s, color 0.3s; 
//         }
        
//         #preview { 
//             outline: none; 
//             padding: 30px 50px 40vh 50px; 
//             min-height: 100vh; 
//             box-sizing: border-box; 
//         }

//         h1, h2, h3 { color: var(--h-color); border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-top: 20px; text-indent: 0; }
//         blockquote { border-left: 4px solid #007acc; background-color: var(--bq-bg); padding: 10px 15px; margin: 15px 0; color: var(--bq-text); border-radius: 0 4px 4px 0; text-indent: 0; }
//         code { background: var(--code-bg); padding: 3px 6px; border-radius: 4px; color: var(--code-text); font-family: Consolas, monospace; font-size: 0.9em; text-indent: 0; }
        
//         #preview p { text-indent: 2em; margin: 0.5em 0; }

//         span.math-wrapper.inline-math { display: inline; text-indent: 0; }
        
//         math-field { 
//             border-radius: 4px; background: transparent; color: var(--math-text); box-sizing: border-box; border: none; 
//             outline: 1px solid transparent; padding: 0; margin: 0; font-size: 1em; min-height: 0 !important; 
//             vertical-align: middle; margin: -0.2em 0.1em; display: inline-block; transition: color 0.3s;
//         }

//         math-field::part(menu-toggle),
//         math-field::part(virtual-keyboard-toggle) { display: none; }

//         math-field:focus-within { outline: 1px solid #8ab4f8; background: var(--math-focus-bg); box-shadow: 0 0 5px rgba(138, 180, 248, 0.4); margin: 0 2px; }
//         math-field:focus-within::part(menu-toggle),
//         math-field:focus-within::part(virtual-keyboard-toggle) { display: flex; }

//         math-field.active-math { background: #e3f2fd; outline: 1px solid #2196f3; box-shadow: 0 0 8px rgba(33, 150, 243, 0.4); color: #000; }

//         span.math-wrapper.block-math { 
//             display: block; width: 100%; margin: 15px 0; overflow-x: auto; overflow-y: hidden; 
//             text-align: center; padding: 10px 0; text-indent: 0; 
//         }
        
//         span.math-wrapper.block-math math-field { display: inline-block; padding: 8px 15px; min-width: min-content; max-width: none; margin: 0; }

//         span.math-wrapper.block-math::-webkit-scrollbar { height: 6px; }
//         span.math-wrapper.block-math::-webkit-scrollbar-thumb { background-color: var(--scrollbar-bg); border-radius: 4px; transition: background 0.3s; }

//         /* 悬浮切换按钮 */
//         #theme-btn {
//             position: fixed; bottom: 30px; right: 30px; width: 45px; height: 45px; border-radius: 50%;
//             background: var(--text-color); color: var(--bg-color); border: none; cursor: pointer;
//             box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 20px; display: flex; align-items: center; justify-content: center;
//             transition: transform 0.2s, background 0.3s, color 0.3s; z-index: 9999; user-select: none;
//         }
//         #theme-btn:hover { transform: scale(1.1); }
//     </style>
// </head>
// <body>
//     <div id="preview" contenteditable="true"></div>
//     <button id="theme-btn" title="切换专注模式">🌓</button>

//     <script>
//         const vscode = acquireVsCodeApi();
//         const preview = document.getElementById('preview');

//         // 主题切换
//         const themeBtn = document.getElementById('theme-btn');
//         if (localStorage.getItem('mathlive-theme') === 'dark') {
//             document.body.classList.add('dark-mode');
//         }
//         themeBtn.addEventListener('click', () => {
//             document.body.classList.toggle('dark-mode');
//             localStorage.setItem('mathlive-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
//         });

//         function beautifyLatex(latex) {
//             if (!latex) return '';
//             let step1 = latex
//                 .replace(/\\\\\\\\/g, '\\\\\\\\\\n    ') 
//                 .replace(/(\\\\begin{[^}]+}(?:{[^}]+})?)/g, '\\n$1\\n')
//                 .replace(/(\\\\end{[^}]+})/g, '\\n$1\\n')
//                 .replace(/(\\\\left(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n')
//                 .replace(/(\\\\right(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n');

//             let lines = step1.split('\\n').map(l => l.trim()).filter(l => l);
//             let result = [];
//             let indent = 0;

//             for (let i = 0; i < lines.length; i++) {
//                 let line = lines[i];
//                 if (line.match(/^\\\\end{/) || line.match(/^\\\\right/)) {
//                     indent = Math.max(0, indent - 1);
//                 }
//                 result.push('    '.repeat(indent) + line);
//                 if (line.match(/^\\\\begin{/) || line.match(/^\\\\left/)) {
//                     indent++;
//                 }
//             }

//             let finalStr = result.join('\\n');
//             finalStr = finalStr.replace(/([^\\n]+)\\n\\s*(\\\\left)/g, '$1 $2');
//             finalStr = finalStr.replace(/(\\\\right[^\\n]+)\\n\\s*(\\\\tag)/g, '$1 $2');
            
//             return finalStr;
//         }

//         const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        
//         turndownService.escape = function (string) { return string; };

//         turndownService.addRule('mathWrapper', {
//             filter: function (node, options) {
//                 return node.nodeName === 'SPAN' && node.classList.contains('math-wrapper');
//             },
//             replacement: function (content, node) {
//                 const mfClone = node.querySelector('math-field');
//                 if (!mfClone) return '';
//                 const index = mfClone.getAttribute('data-index');
                
//                 const realMf = document.querySelector(\`math-field[data-index="\${index}"]\`);
//                 const isBlock = node.classList.contains('block-math');

//                 if (realMf && realMf.hasAttribute('data-dirty')) {
//                     let latex = realMf.getValue();
//                     if (isBlock) {
//                         latex = beautifyLatex(latex); 
//                     }
//                     return isBlock ? \`\\n\\n$$\\n\${latex}\\n$$\\n\\n\` : \`$\${latex}$\`;
//                 } else {
//                     const rawLatex = decodeURIComponent(node.getAttribute('data-raw'));
//                     return isBlock ? \`$$\${rawLatex}$$\` : \`$\${rawLatex}$\`;
//                 }
//             }
//         });

//         let scrollSyncTimer;

//         window.addEventListener('message', event => {
//             if (event.data.command === 'renderFull') {
//                 renderMarkdown(event.data.text);
//             }
            
//             if (event.data.command === 'updateMathOnly') {
//                 event.data.changes.forEach(change => {
//                     const mf = document.querySelector(\`math-field[data-index="\${change.index}"]\`);
//                     if (mf && mf.getValue() !== change.latex) {
//                         mf.setValue(change.latex, { suppressChangeNotifications: true });
//                         mf.removeAttribute('data-dirty');
//                         const wrapper = mf.closest('.math-wrapper');
//                         if (wrapper) {
//                             wrapper.setAttribute('data-raw', encodeURIComponent(change.latex));
//                         }
//                     }
//                 });
//             }

//             if (event.data.command === 'focusMath') {
//                 document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//                 const mf = document.querySelector(\`math-field[data-index="\${event.data.index}"]\`);
//                 if (mf) {
//                     mf.classList.add('active-math');
//                     const rect = mf.getBoundingClientRect();
//                     if(rect.top < 0 || rect.bottom > window.innerHeight) {
//                         mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                     }
//                 }
//             }

//             if (event.data.command === 'blurMath') {
//                 document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//             }

//             if (event.data.command === 'syncPreviewToEditor') {
//                 clearTimeout(scrollSyncTimer);
//                 scrollSyncTimer = setTimeout(() => {
//                     const cleanSearch = event.data.text.replace(/[#\\*\\->\\s\\$\`_\\[\\]\\(\\)]/g, '');
//                     if (cleanSearch.length < 2) return;

//                     const snippet = cleanSearch.substring(0, 20);

//                     const elements = preview.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
//                     for (let el of elements) {
//                         const cleanElText = (el.textContent || '').replace(/\\s/g, '');
//                         if (!cleanElText) continue;

//                         if (cleanElText.includes(snippet)) {
//                             const rect = el.getBoundingClientRect();
//                             if(rect.top < 0 || rect.bottom > window.innerHeight) {
//                                 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                             }
//                             break;
//                         }
//                     }
//                 }, 100); 
//             }
//         });

//         // 【终极修复】：更改隐形标记为不会被 Markdown 误解析的纯字母组合，解决暴露残影的问题！
//         preview.addEventListener('keydown', (e) => {
//             if (e.key === 'Enter') {
//                 setTimeout(() => {
//                     const sel = window.getSelection();
//                     if (!sel.rangeCount) return;

//                     const range = sel.getRangeAt(0);
//                     const markerNode = document.createTextNode('CURSORMARKER');
//                     range.insertNode(markerNode);
//                     range.setStartAfter(markerNode);
//                     range.collapse(true);
//                     sel.removeAllRanges();
//                     sel.addRange(range);

//                     const mdText = turndownService.turndown(preview);
                    
//                     vscode.postMessage({
//                         command: 'editFullText',
//                         text: mdText.replace(/CURSORMARKER/g, '')
//                     });

//                     renderMarkdown(mdText);

//                     const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
//                     let node;
//                     while ((node = walker.nextNode())) {
//                         if (node.nodeValue.includes('CURSORMARKER')) {
//                             const offset = node.nodeValue.indexOf('CURSORMARKER');
//                             node.nodeValue = node.nodeValue.replace('CURSORMARKER', '');
                            
//                             const newRange = document.createRange();
//                             newRange.setStart(node, offset);
//                             newRange.collapse(true);
//                             sel.removeAllRanges();
//                             sel.addRange(newRange);
                            
//                             if (node.parentElement) {
//                                 const rect = node.parentElement.getBoundingClientRect();
//                                 if(rect.top < 0 || rect.bottom > window.innerHeight) {
//                                     node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                                 }
//                             }
//                             break;
//                         }
//                     }
//                 }, 10);
//             }
//         });

//         let textEditTimer;
//         preview.addEventListener('input', (e) => {
//             if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;

//             clearTimeout(textEditTimer);
//             textEditTimer = setTimeout(() => {
//                 const markdownText = turndownService.turndown(preview);
//                 vscode.postMessage({
//                     command: 'editFullText',
//                     text: markdownText
//                 });
//             }, 400); 
//         });

//         preview.addEventListener('paste', () => {
//             setTimeout(() => {
//                 const markdownText = turndownService.turndown(preview);
//                 renderMarkdown(markdownText);
//             }, 50);
//         });

//         preview.addEventListener('focusout', (e) => {
//             if (preview.contains(e.relatedTarget)) return;
//             const markdownText = turndownService.turndown(preview);
//             renderMarkdown(markdownText);
//         });

//         preview.addEventListener('click', (e) => {
//             if (e.target === preview) {
//                 let lastChild = preview.lastElementChild;
//                 if (lastChild && lastChild.classList.contains('math-wrapper')) {
//                     const p = document.createElement('p');
//                     p.innerHTML = '<br>';
//                     preview.appendChild(p);
//                     lastChild = p;
//                 }
                
//                 setTimeout(() => {
//                     const sel = window.getSelection();
//                     const range = document.createRange();
//                     range.selectNodeContents(lastChild || preview);
//                     range.collapse(false);
//                     sel.removeAllRanges();
//                     sel.addRange(range);
//                 }, 10);
//             }

//             if (e.altKey) {
//                 if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;
                
//                 const block = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
//                 if (block) {
//                     const mdText = turndownService.turndown(block).trim();
//                     vscode.postMessage({
//                         command: 'syncTextToEditor',
//                         text: mdText
//                     });
//                 }
//             }
//         });

//         function renderMarkdown(text) {
//             const mathBlocks = [];

//             const tempText = text.replace(/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$)/g, (match) => {
//                 const isBlock = match.startsWith('$$');
//                 const inner = isBlock ? match.slice(2, -2) : match.slice(1, -1);
//                 mathBlocks.push({ isBlock, inner: inner }); 
//                 return \`%%%MATH_\${mathBlocks.length - 1}%%%\`;
//             });

//             let html = marked.parse(tempText);

//             html = html.replace(/%%%MATH_(\\d+)%%%/g, (_match, p1) => {
//                 const index = parseInt(p1, 10);
//                 const block = mathBlocks[index];
//                 const cls = block.isBlock ? 'block-math' : 'inline-math';

//                 const escapedInner = block.inner.replace(/\\s+/g, ' ')
//                     .replace(/&/g, '&amp;')
//                     .replace(/</g, '&lt;')
//                     .replace(/>/g, '&gt;');

//                 const encodedRaw = encodeURIComponent(block.inner);

//                 return \`<span contenteditable="false" class="math-wrapper \${cls}" data-raw="\${encodedRaw}"><math-field data-index="\${index}" virtual-keyboard-mode="onfocus">\${escapedInner}</math-field></span>\`;
//             });

//             preview.innerHTML = html;

//             preview.querySelectorAll('math-field').forEach((mf) => {
//                 const send = () => {
//                     mf.setAttribute('data-dirty', 'true');
                    
//                     let latex = mf.getValue();
//                     const isBlock = mf.closest('.math-wrapper').classList.contains('block-math');
                    
//                     if (isBlock) {
//                         latex = beautifyLatex(latex);
//                     }
                    
//                     vscode.postMessage({
//                         command: 'editMath',
//                         index: Number(mf.dataset.index),
//                         latex: latex
//                     });
//                 };

//                 mf.addEventListener('input', send);

//                 mf.addEventListener('focusin', () => {
//                     document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
//                     vscode.postMessage({
//                         command: 'focusEditor',
//                         index: Number(mf.dataset.index)
//                     });
//                 });
//             });
//         }
//     </script>
// </body>
// </html>`;
// }
import * as vscode from 'vscode';

type IndexedMathMatch = {
    index: number;
    fullText: string;
    innerText: string;
    start: number;
    end: number;
    isBlock: boolean;
    isMultilineBlock: boolean;
    documentUri: vscode.Uri;
};

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined;
    let boundEditor: vscode.TextEditor | undefined;
    let isApplyingFromWebview = false;
    let isSyncingFocus = false; 

    let lastStructText = '';
    let lastMatches: IndexedMathMatch[] = [];

    context.subscriptions.push(
        vscode.commands.registerCommand('mathlive-sync.helloWorld', () => {
            renderEditor(vscode.window.activeTextEditor, true); 
        })
    );

    function getMathMatches(text: string, documentUri: vscode.Uri): IndexedMathMatch[] {
        const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
        const matches: IndexedMathMatch[] = [];

        let match: RegExpExecArray | null;
        let idx = 0;

        while ((match = regex.exec(text)) !== null) {
            const fullText = match[0];
            const isBlock = fullText.startsWith('$$');
            const innerText = isBlock ? fullText.slice(2, -2) : fullText.slice(1, -1);

            matches.push({
                index: idx,
                fullText,
                innerText: innerText,
                start: match.index,
                end: match.index + fullText.length,
                isBlock,
                isMultilineBlock: isBlock && fullText.includes('\n'),
                documentUri
            });

            idx++;
        }
        return matches;
    }

    function getStructuralText(text: string, matches: IndexedMathMatch[]) {
        let res = '';
        let lastEnd = 0;
        for (let i = 0; i < matches.length; i++) {
            res += text.slice(lastEnd, matches[i].start) + `%%%MATH_${i}%%%`;
            lastEnd = matches[i].end;
        }
        res += text.slice(lastEnd);
        return res;
    }

    function renderEditor(editor: vscode.TextEditor | undefined, forceFull = false) {
        // if (!editor || editor.document.languageId !== 'markdown') return;
        if (!editor || (editor.document.languageId !== 'markdown' && editor.document.languageId !== 'latex')) return;
        boundEditor = editor;
        ensurePanel();

        const text = editor.document.getText();
        const matches = getMathMatches(text, editor.document.uri);
        const structText = getStructuralText(text, matches);

        if (!forceFull && currentPanel && structText === lastStructText && matches.length === lastMatches.length) {
            const changes = [];
            for (let i = 0; i < matches.length; i++) {
                if (matches[i].innerText !== lastMatches[i].innerText) {
                    changes.push({ index: i, latex: matches[i].innerText });
                }
            }
            if (changes.length > 0) {
                currentPanel.webview.postMessage({ command: 'updateMathOnly', changes });
            }
            lastMatches = matches;
            return;
        }

        lastStructText = structText;
        lastMatches = matches;
        currentPanel?.webview.postMessage({ command: 'renderFull', text });
    }

    function ensurePanel() {
        if (currentPanel) return;

        currentPanel = vscode.window.createWebviewPanel(
            'mathLive', 'GNN 论文全景预览',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true }
        );

        currentPanel.webview.html = getWebviewContent();

        currentPanel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'focusEditor') {
                const editor = boundEditor;
                if (!editor) return;
                
                const matches = getMathMatches(editor.document.getText(), editor.document.uri);
                const target = matches[Number(message.index)];
                
                if (target) {
                    isSyncingFocus = true; 
                    const delimiterLen = target.isBlock ? 2 : 1;
                    const pos = editor.document.positionAt(target.start + delimiterLen);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    setTimeout(() => { isSyncingFocus = false; }, 100); 
                }
                return;
            }

            if (message.command === 'syncTextToEditor') {
                const editor = boundEditor;
                if (!editor) return;

                const searchStr = String(message.text).trim();
                if (!searchStr) return;

                const docText = editor.document.getText();
                let idx = docText.indexOf(searchStr);
                if (idx === -1) {
                    const snippet = searchStr.substring(0, 15);
                    idx = docText.indexOf(snippet);
                }

                if (idx >= 0) {
                    isSyncingFocus = true; 
                    const pos = editor.document.positionAt(idx);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    setTimeout(() => { isSyncingFocus = false; }, 100); 
                }
                return;
            }

            if (message.command === 'editFullText') {
                const editor = boundEditor;
                if (!editor) return;

                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );

                const edit = new vscode.WorkspaceEdit();
                edit.replace(editor.document.uri, fullRange, String(message.text));

                isApplyingFromWebview = true;
                const ok = await vscode.workspace.applyEdit(edit);
                isApplyingFromWebview = false;

                if (!ok) {
                    vscode.window.showWarningMessage('文本回写失败');
                }
                return;
            }

            if (message.command !== 'editMath') return;

            const editor = boundEditor;
            if (!editor) return;

            const text = editor.document.getText();
            const matches = getMathMatches(text, editor.document.uri);
            const target = matches[Number(message.index)];

            if (!target) return;

            let newLatex = String(message.latex ?? '').trim();
            const replacement = target.isBlock ? `$$\n${newLatex}\n$$` : `$${newLatex}$`;

            const startPos = editor.document.positionAt(target.start);
            const endPos = editor.document.positionAt(target.end);

            const edit = new vscode.WorkspaceEdit();
            edit.replace(target.documentUri, new vscode.Range(startPos, endPos), replacement);

            isApplyingFromWebview = true;
            const ok = await vscode.workspace.applyEdit(edit);
            isApplyingFromWebview = false;

            if (!ok) {
                vscode.window.showWarningMessage('公式回写失败');
            }
        });

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
            boundEditor = undefined;
        });
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            const editor = boundEditor;
            if (!editor || !currentPanel || e.document.uri.toString() !== editor.document.uri.toString()) {
                return;
            }

            if (isApplyingFromWebview) {
                const text = editor.document.getText();
                const matches = getMathMatches(text, editor.document.uri);
                lastStructText = getStructuralText(text, matches);
                lastMatches = matches;
                return;
            }

            renderEditor(editor, false);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            renderEditor(editor, true);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            // if (event.textEditor.document.languageId === 'markdown') {
            if (event.textEditor.document.languageId === 'markdown' || event.textEditor.document.languageId === 'latex') {
                boundEditor = event.textEditor;

                if (isSyncingFocus || !currentPanel) return;

                const offset = event.textEditor.document.offsetAt(event.selections[0].active);
                const text = event.textEditor.document.getText();
                const matches = getMathMatches(text, event.textEditor.document.uri);
                
                const target = matches.find(m => {
                    const delimiterLen = m.isBlock ? 2 : 1;
                    return offset >= m.start + delimiterLen && offset <= m.end - delimiterLen;
                });
                if (target) {
                    currentPanel.webview.postMessage({
                        command: 'focusMath',
                        index: target.index
                    });
                } else {
                    currentPanel.webview.postMessage({ command: 'blurMath' });
                    
                    const activeLineStr = event.textEditor.document.lineAt(event.selections[0].active.line).text.trim();
                    if (activeLineStr) {
                        currentPanel.webview.postMessage({
                            command: 'syncPreviewToEditor',
                            text: activeLineStr
                        });
                    }
                }
            }
        })
    );

    // if (vscode.window.activeTextEditor?.document.languageId === 'markdown') {
    //     renderEditor(vscode.window.activeTextEditor, true);
    // }
    const langId = vscode.window.activeTextEditor?.document.languageId;
    if (langId === 'markdown' || langId === 'latex') {
        renderEditor(vscode.window.activeTextEditor, true);
    }
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
    <script type="module" src="https://unpkg.com/mathlive?module"></script>
    <style>
        :root {
            --bg-color: #f6f0df;
            --text-color: #333333;
            --h-color: #1a1a1a;
            --border-color: #eaeaea;
            --bq-bg: #f9f9f9;
            --bq-text: #555;
            --code-bg: #f0f0f0;
            --code-text: #d14;
            --math-text: #000000;
            --math-focus-bg: #fcfcfc;
            --scrollbar-bg: #ccc;
            --math-active-bg: #e3f2fd;
            --math-active-text: #000000;
            --math-selection-bg: rgba(33, 150, 243, 0.3);
        }

        body.dark-mode {
            --bg-color: #181818;
            --text-color: #f0f0f0;
            --h-color: #ffffff;
            --border-color: #444444;
            --bq-bg: #2d2d2d;
            --bq-text: #aaaaaa;
            --code-bg: #2d2d2d;
            --code-text: #ce9178;
            --math-text: #f0f0f0;
            --math-focus-bg: transparent;
            --scrollbar-bg: #555555;
            --math-selection-bg: rgba(100, 149, 237, 0.25);
            --math-active-bg: transparent;
            --math-active-text: #ffffff;
        }

        body { 
            background: var(--bg-color); color: var(--text-color); margin: 0; padding: 0; 
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; 
            line-height: 1.4; font-size: 16px; transition: background 0.3s, color 0.3s; 
        }

        #preview { 
            outline: none; 
            padding: 30px 50px 40vh 50px; 
            min-height: 100vh; 
            box-sizing: border-box; 
        }

        h1, h2, h3 { color: var(--h-color); border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-top: 20px; text-indent: 0; }
        blockquote { border-left: 4px solid #0a0a0b; background-color: var(--bq-bg); padding: 10px 15px; margin: 15px 0; color: var(--bq-text); border-radius: 0 4px 4px 0; text-indent: 0; }
        code { background: var(--code-bg); padding: 3px 6px; border-radius: 4px; color: var(--code-text); font-family: Consolas, monospace; font-size: 0.9em; text-indent: 0; }

        #preview p { text-indent: 2em; margin: 0.5em 0; }

        span.math-wrapper.inline-math { display: inline; text-indent: 0; }

        math-field { 
            border-radius: 4px;
            background: transparent !important;
            background-color: transparent !important;
            color: var(--math-text) !important;
            box-sizing: border-box;
            border: none;
            outline: 1px solid transparent;
            padding: 0;
            margin: -0.2em 0.1em;
            font-size: 1em;
            min-height: 0 !important;
            vertical-align: middle;
            display: inline-block;
            transition: color 0.3s, background-color 0.3s;
            --selection-background-color: var(--math-selection-bg);
            --selection-color: var(--math-active-text);
            --contains-highlight-background-color: transparent;
        }
        math-field::part(container),
        math-field::part(content) {
            background: transparent !important;
            background-color: transparent !important;
            color: inherit !important;
        }

        body.dark-mode math-field,
        body.dark-mode math-field::part(container),
        body.dark-mode math-field::part(content) {
            background: transparent !important;
            background-color: transparent !important;
            color: var(--math-text) !important;
        }

        math-field::part(menu-toggle),
        math-field::part(virtual-keyboard-toggle) { 
            display: none; 
        }

        math-field:focus-within {
            outline: 1px solid #8ab4f8;
            background: transparent !important;
            box-shadow: 0 0 5px rgba(138, 180, 248, 0.25);
            margin: 0 2px;
        }
        math-field:focus-within::part(menu-toggle),
        math-field:focus-within::part(virtual-keyboard-toggle) { 
            display: flex; 
        }

        math-field.active-math { 
            background: transparent !important;
            outline: 1px solid #8ab4f8;
            box-shadow: 0 0 8px rgba(138, 180, 248, 0.2);
            color: var(--math-active-text) !important;
        }

        span.math-wrapper.block-math { 
            display: block; width: 100%; margin: 15px 0; overflow-x: auto; overflow-y: hidden; 
            text-align: center; padding: 10px 0; text-indent: 0; 
        }

        span.math-wrapper.block-math math-field { 
            display: inline-block; padding: 8px 15px; min-width: min-content; max-width: none; margin: 0; 
        }

        span.math-wrapper.inline-math,
        span.math-wrapper.block-math {
            background: transparent !important;
        }

        span.math-wrapper.block-math::-webkit-scrollbar { height: 6px; }
        span.math-wrapper.block-math::-webkit-scrollbar-thumb { background-color: var(--scrollbar-bg); border-radius: 4px; transition: background 0.3s; }

        #theme-btn {
            position: fixed; bottom: 30px; right: 30px; width: 45px; height: 45px; border-radius: 50%;
            background: var(--text-color); color: var(--bg-color); border: none; cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 20px; display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s, background 0.3s, color 0.3s; z-index: 9999; user-select: none;
        }
        #theme-btn:hover { transform: scale(1.1); }
    </style>
</head>
<body>
    <div id="preview" contenteditable="true"></div>
    <button id="theme-btn" title="切换专注模式">🌓</button>

    <script>
        const vscode = acquireVsCodeApi();
        const preview = document.getElementById('preview');

        const themeBtn = document.getElementById('theme-btn');
        if (localStorage.getItem('mathlive-theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('mathlive-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });

        function beautifyLatex(latex) {
            if (!latex) return '';
            let step1 = latex
                .replace(/\\\\\\\\/g, '\\\\\\\\\\n    ') 
                .replace(/(\\\\begin{[^}]+}(?:{[^}]+})?)/g, '\\n$1\\n')
                .replace(/(\\\\end{[^}]+})/g, '\\n$1\\n')
                .replace(/(\\\\left(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n')
                .replace(/(\\\\right(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n');

            let lines = step1.split('\\n').map(l => l.trim()).filter(l => l);
            let result = [];
            let indent = 0;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (line.match(/^\\\\end{/) || line.match(/^\\\\right/)) {
                    indent = Math.max(0, indent - 1);
                }
                result.push('    '.repeat(indent) + line);
                if (line.match(/^\\\\begin{/) || line.match(/^\\\\left/)) {
                    indent++;
                }
            }

            let finalStr = result.join('\\n');
            finalStr = finalStr.replace(/([^\\n]+)\\n\\s*(\\\\left)/g, '$1 $2');
            finalStr = finalStr.replace(/(\\\\right[^\\n]+)\\n\\s*(\\\\tag)/g, '$1 $2');
            
            return finalStr;
        }

        const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        
        turndownService.escape = function (string) { return string; };

        turndownService.addRule('mathWrapper', {
            filter: function (node, options) {
                return node.nodeName === 'SPAN' && node.classList.contains('math-wrapper');
            },
            replacement: function (content, node) {
                const mfClone = node.querySelector('math-field');
                if (!mfClone) return '';
                const index = mfClone.getAttribute('data-index');
                
                const realMf = document.querySelector(\`math-field[data-index="\${index}"]\`);
                const isBlock = node.classList.contains('block-math');

                if (realMf && realMf.hasAttribute('data-dirty')) {
                    let latex = realMf.getValue();
                    if (isBlock) {
                        latex = beautifyLatex(latex); 
                    }
                    return isBlock ? \`\\n\\n$$\\n\${latex}\\n$$\\n\\n\` : \`$\${latex}$\`;
                } else {
                    const rawLatex = decodeURIComponent(node.getAttribute('data-raw'));
                    return isBlock ? \`$$\${rawLatex}$$\` : \`$\${rawLatex}$\`;
                }
            }
        });

        let scrollSyncTimer;

        window.addEventListener('message', event => {
            if (event.data.command === 'renderFull') {
                renderMarkdown(event.data.text);
            }
            
            if (event.data.command === 'updateMathOnly') {
                event.data.changes.forEach(change => {
                    const mf = document.querySelector(\`math-field[data-index="\${change.index}"]\`);
                    if (mf && mf.getValue() !== change.latex) {
                        mf.setValue(change.latex, { suppressChangeNotifications: true });
                        mf.removeAttribute('data-dirty');
                        const wrapper = mf.closest('.math-wrapper');
                        if (wrapper) {
                            wrapper.setAttribute('data-raw', encodeURIComponent(change.latex));
                        }
                    }
                });
            }

            if (event.data.command === 'focusMath') {
                document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
                const mf = document.querySelector(\`math-field[data-index="\${event.data.index}"]\`);
                if (mf) {
                    mf.classList.add('active-math');
                    const rect = mf.getBoundingClientRect();
                    if(rect.top < 0 || rect.bottom > window.innerHeight) {
                        mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }

            if (event.data.command === 'blurMath') {
                document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
            }

            if (event.data.command === 'syncPreviewToEditor') {
                clearTimeout(scrollSyncTimer);
                scrollSyncTimer = setTimeout(() => {
                    const cleanSearch = event.data.text.replace(/[#\\*\\->\\s\\$\`_\\[\\]\\(\\)]/g, '');
                    if (cleanSearch.length < 2) return;

                    const snippet = cleanSearch.substring(0, 20);

                    const elements = preview.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
                    for (let el of elements) {
                        const cleanElText = (el.textContent || '').replace(/\\s/g, '');
                        if (!cleanElText) continue;

                        if (cleanElText.includes(snippet)) {
                            const rect = el.getBoundingClientRect();
                            if(rect.top < 0 || rect.bottom > window.innerHeight) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                            break;
                        }
                    }
                }, 100); 
            }
        });

        // 【新增 1】：无痕游标渲染函数，解决光标丢失问题（用物理宽度0的隐形字符 \u200B ）
        function renderAndRestoreCursor() {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            
            const marker = document.createTextNode('\\u200B');
            range.insertNode(marker);
            range.setStartAfter(marker);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            const mdText = turndownService.turndown(preview);
            
            vscode.postMessage({
                command: 'editFullText',
                text: mdText.replace(/\\u200B/g, '') // 发给代码源时不带隐形标记
            });

            renderMarkdown(mdText);

            const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue.includes('\\u200B')) {
                    const offset = node.nodeValue.indexOf('\\u200B');
                    node.nodeValue = node.nodeValue.replace('\\u200B', '');
                    const newRange = document.createRange();
                    newRange.setStart(node, offset);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    break;
                }
            }
        }

        // 【新增 2】：监听上下左右方向键。写完公式后只要按方向键游走，自动无痕渲染
        preview.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const sel = window.getSelection();
                if (sel && sel.focusNode && sel.focusNode.nodeType === Node.TEXT_NODE) {
                    if (/(?<!\\\\)\\$\\$[\\s\\S]*?(?<!\\\\)\\$\\$|(?<!\\\\)\\$[^$\\n]+?(?<!\\\\)\\$/.test(sel.focusNode.textContent)) {
                        renderAndRestoreCursor();
                    }
                }
            }
        });

        let textEditTimer;
        preview.addEventListener('input', (e) => {
            if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;

            // 【新增 3】：敲完公式的闭合符号后，只要紧接着敲下一个字符（例如空格、逗号），立刻触发无痕渲染！
            const sel = window.getSelection();
            if (sel && sel.focusNode && sel.focusNode.nodeType === Node.TEXT_NODE) {
                if (/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$)./.test(sel.focusNode.textContent)) {
                    renderAndRestoreCursor();
                    return; // 已经主动渲染，不用等 400ms 的防抖了
                }
            }

            clearTimeout(textEditTimer);
            textEditTimer = setTimeout(() => {
                const markdownText = turndownService.turndown(preview);
                vscode.postMessage({
                    command: 'editFullText',
                    text: markdownText
                });
            }, 400); 
        });

        // 粘贴自动渲染公式
        preview.addEventListener('paste', () => {
            setTimeout(() => {
                const markdownText = turndownService.turndown(preview);
                renderMarkdown(markdownText);
            }, 50);
        });

        // 失去焦点自动渲染公式
        preview.addEventListener('focusout', (e) => {
            if (preview.contains(e.relatedTarget)) return;
            const markdownText = turndownService.turndown(preview);
            renderMarkdown(markdownText);
        });

        preview.addEventListener('click', (e) => {
            if (e.target === preview) {
                let lastChild = preview.lastElementChild;
                if (lastChild && lastChild.classList.contains('math-wrapper')) {
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    preview.appendChild(p);
                    lastChild = p;
                }
                
                setTimeout(() => {
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(lastChild || preview);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }, 10);
            }

            if (e.altKey) {
                if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;
                
                const block = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
                if (block) {
                    const mdText = turndownService.turndown(block).trim();
                    vscode.postMessage({
                        command: 'syncTextToEditor',
                        text: mdText
                    });
                }
            }
        });

        function renderMarkdown(text) {
            const mathBlocks = [];

            const tempText = text.replace(/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$)/g, (match) => {
                const isBlock = match.startsWith('$$');
                const inner = isBlock ? match.slice(2, -2) : match.slice(1, -1);
                mathBlocks.push({ isBlock, inner: inner }); 
                return \`%%%MATH_\${mathBlocks.length - 1}%%%\`;
            });

            let html = marked.parse(tempText);

            html = html.replace(/%%%MATH_(\\d+)%%%/g, (_match, p1) => {
                const index = parseInt(p1, 10);
                const block = mathBlocks[index];
                const cls = block.isBlock ? 'block-math' : 'inline-math';

                const escapedInner = block.inner.replace(/\\s+/g, ' ')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                const encodedRaw = encodeURIComponent(block.inner);

                return \`<span contenteditable="false" class="math-wrapper \${cls}" data-raw="\${encodedRaw}"><math-field data-index="\${index}" virtual-keyboard-mode="onfocus">\${escapedInner}</math-field></span>\`;
            });

            preview.innerHTML = html;

            preview.querySelectorAll('math-field').forEach((mf) => {
                const send = () => {
                    mf.setAttribute('data-dirty', 'true');
                    
                    let latex = mf.getValue();
                    const isBlock = mf.closest('.math-wrapper').classList.contains('block-math');
                    
                    if (isBlock) {
                        latex = beautifyLatex(latex);
                    }
                    
                    vscode.postMessage({
                        command: 'editMath',
                        index: Number(mf.dataset.index),
                        latex: latex
                    });
                };

                mf.addEventListener('input', send);

                mf.addEventListener('focusin', () => {
                    document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
                    vscode.postMessage({
                        command: 'focusEditor',
                        index: Number(mf.dataset.index)
                    });
                });
            });
        }
    </script>
</body>
</html>`;
}