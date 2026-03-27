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
    envPrefix: string; 
    envSuffix: string; 
};

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined;
    let boundEditor: vscode.TextEditor | undefined;
    let isApplyingFromWebview = false;
    let isSyncingFocus = false; 

    let lastStructText = '';
    let lastMatches: IndexedMathMatch[] = [];
    
    // 💡 防抖计时器
    let renderTimeout: NodeJS.Timeout | undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('mathlive-sync.helloWorld', () => {
            renderEditor(vscode.window.activeTextEditor, true); 
        })
    );

    function getMathMatches(text: string, documentUri: vscode.Uri): IndexedMathMatch[] {
        const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\)|\\begin\{(?:equation|align|gather|eqnarray|multline|alignat)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|eqnarray|multline|alignat)\*?\})/g;
        const matches: IndexedMathMatch[] = [];
        let match: RegExpExecArray | null;
        let idx = 0;

        while ((match = regex.exec(text)) !== null) {
            const fullText = match[0];
            let isBlock = false;
            let innerText = fullText;
            let envPrefix = '';
            let envSuffix = '';

            if (fullText.startsWith('$$')) {
                isBlock = true; innerText = fullText.slice(2, -2);
                envPrefix = '$$'; envSuffix = '$$';
            } else if (fullText.startsWith('\\[')) {
                isBlock = true; innerText = fullText.slice(2, -2);
                envPrefix = '\\['; envSuffix = '\\]';
            } else if (fullText.startsWith('\\(')) {
                isBlock = false; innerText = fullText.slice(2, -2);
                envPrefix = '\\('; envSuffix = '\\)';
            } else if (fullText.startsWith('\\begin')) {
                isBlock = true; innerText = fullText; 
                envPrefix = ''; envSuffix = ''; 
            } else if (fullText.startsWith('$')) {
                isBlock = false; innerText = fullText.slice(1, -1);
                envPrefix = '$'; envSuffix = '$';
            }

            matches.push({
                index: idx, fullText, innerText,
                start: match.index, end: match.index + fullText.length,
                isBlock, isMultilineBlock: isBlock && fullText.includes('\n'),
                documentUri, envPrefix, envSuffix
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
        currentPanel?.webview.postMessage({ 
            command: 'renderFull', 
            text, 
            languageId: editor.document.languageId 
        });
    }

    function ensurePanel() {
        if (currentPanel) return;

        currentPanel = vscode.window.createWebviewPanel(
            'mathLive', '论文全景预览',
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
                    const delimiterLen = target.isBlock ? (target.envPrefix.length || 0) : (target.envPrefix.length || 0);
                    const offset = target.envPrefix === '' ? 0 : delimiterLen;
                    const pos = editor.document.positionAt(target.start + offset);
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
            let replacement = '';

            if (target.envPrefix === '') {
                replacement = newLatex; 
            } else if (target.isBlock && target.envPrefix === '$$') {
                replacement = `$$\n${newLatex}\n$$`;
            } else if (target.isBlock && target.envPrefix === '\\[') {
                replacement = `\\[\n${newLatex}\n\\]`;
            } else {
                replacement = `${target.envPrefix}${newLatex}${target.envSuffix}`;
            }

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

            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(() => {
                renderEditor(editor, false);
            }, 300);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            renderEditor(editor, true);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor.document.languageId === 'markdown' || event.textEditor.document.languageId === 'latex') {
                boundEditor = event.textEditor;

                if (isSyncingFocus || !currentPanel) return;

                const offset = event.textEditor.document.offsetAt(event.selections[0].active);
                const text = event.textEditor.document.getText();
                const matches = getMathMatches(text, event.textEditor.document.uri);
                
                const target = matches.find(m => {
                    const delimiterLen = m.isBlock ? (m.envPrefix.length || 0) : (m.envPrefix.length || 0);
                    const offsetAdj = m.envPrefix === '' ? 0 : delimiterLen;
                    return offset >= m.start + offsetAdj && offset <= m.end - offsetAdj;
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

    const activeLangId = vscode.window.activeTextEditor?.document.languageId;
    if (activeLangId === 'markdown' || activeLangId === 'latex') {
        renderEditor(vscode.window.activeTextEditor, true);
    }
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://fastly.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://fastly.jsdelivr.net/npm/turndown/dist/turndown.js"></script>
    <script type="module" src="https://fastly.jsdelivr.net/npm/mathlive/dist/mathlive.min.mjs"></script>
    <script src="https://fastly.jsdelivr.net/npm/morphdom/dist/morphdom-umd.js"></script>
    <style>
        :root {
            --bg-color: #f6f0df; --text-color: #333333; --h-color: #1a1a1a; --border-color: #eaeaea;
            --bq-bg: #f9f9f9; --bq-text: #555; --code-bg: #f0f0f0; --code-text: #d14;
            --math-text: #000000; --math-focus-bg: #fcfcfc; --scrollbar-bg: #ccc;
            --math-active-bg: #e3f2fd; --math-active-text: #000000; --math-selection-bg: rgba(33, 150, 243, 0.3);
            --beamer-primary: #7e0c6e; --beamer-secondary: #a5559a;
        }

        body.dark-mode {
            --bg-color: #181818; --text-color: #f0f0f0; --h-color: #ffffff; --border-color: #444444;
            --bq-bg: #2d2d2d; --bq-text: #aaaaaa; --code-bg: #2d2d2d; --code-text: #ce9178;
            --math-text: #f0f0f0; --math-focus-bg: transparent; --scrollbar-bg: #555555;
            --math-selection-bg: rgba(100, 149, 237, 0.25); --math-active-bg: transparent; --math-active-text: #ffffff;
            --beamer-primary: #cb9ec5; --beamer-secondary: #a5559a;
        }

        body { background: var(--bg-color); color: var(--text-color); margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; font-size: 16px; transition: background 0.3s, color 0.3s, font-size 0.2s; }
        #preview { outline: none; padding: 30px 50px 40vh 50px; min-height: 100vh; box-sizing: border-box; }
        h1, h2, h3, h4, h5, h6 { color: var(--h-color); border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-top: 20px; text-indent: 0; }
        blockquote { border-left: 4px solid #0a0a0b; background-color: var(--bq-bg); padding: 10px 15px; margin: 15px 0; color: var(--bq-text); border-radius: 0 4px 4px 0; text-indent: 0; }
        code { background: var(--code-bg); padding: 3px 6px; border-radius: 4px; color: var(--code-text); font-family: Consolas, monospace; font-size: 0.9em; text-indent: 0; }

        .beamer-slide { background: var(--bg-color); border: 2px solid var(--border-color); border-radius: 12px; padding: 25px 35px; margin: 30px auto; box-shadow: 0 8px 20px rgba(0,0,0,0.08); page-break-inside: avoid; max-width: 900px; }
        .beamer-frametitle { font-size: 1.4em; font-weight: bold; color: var(--beamer-primary); border-bottom: 2px solid var(--beamer-secondary); padding-bottom: 10px; margin-bottom: 20px; text-indent: 0 !important; }
        .beamer-slide p { text-indent: 0 !important; margin: 0.8em 0; }
        .beamer-slide ul, .beamer-slide ol { padding-left: 2em; margin: 1em 0; }
        .beamer-slide li { margin-bottom: 0.5em; text-indent: 0; }

        span.math-wrapper.inline-math { display: inline; text-indent: 0; }
        math-field { border-radius: 4px; background: transparent !important; color: var(--math-text) !important; box-sizing: border-box; border: none; outline: 1px solid transparent; padding: 0; margin: -0.2em 0.1em; font-size: 1em; min-height: 0 !important; vertical-align: middle; display: inline-block; transition: color 0.3s, background-color 0.3s; --selection-background-color: var(--math-selection-bg); --selection-color: var(--math-active-text); }
        math-field::part(container), math-field::part(content) { background: transparent !important; color: inherit !important; }
        body.dark-mode math-field, body.dark-mode math-field::part(container), body.dark-mode math-field::part(content) { background: transparent !important; color: var(--math-text) !important; }
        math-field::part(menu-toggle), math-field::part(virtual-keyboard-toggle) { display: none; }
        math-field:focus-within { outline: 1px solid #8ab4f8; background: transparent !important; box-shadow: 0 0 5px rgba(138, 180, 248, 0.25); margin: 0 2px; }
        math-field.active-math { outline: 1px solid #8ab4f8; box-shadow: 0 0 8px rgba(138, 180, 248, 0.2); color: var(--math-active-text) !important; }

        span.math-wrapper.block-math { display: block; width: 100%; margin: 15px 0; overflow-x: auto; overflow-y: hidden; text-align: center; padding: 10px 0; text-indent: 0; }
        span.math-wrapper.block-math math-field { display: inline-block; padding: 8px 15px; min-width: min-content; max-width: none; margin: 0; }
        span.math-wrapper.block-math::-webkit-scrollbar { height: 6px; }
        span.math-wrapper.block-math::-webkit-scrollbar-thumb { background-color: var(--scrollbar-bg); border-radius: 4px; transition: background 0.3s; }

        #theme-btn { position: fixed; bottom: 30px; right: 30px; width: 45px; height: 45px; border-radius: 50%; background: var(--text-color); color: var(--bg-color); border: none; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 20px; display: flex; align-items: center; justify-content: center; z-index: 9999; user-select: none; }
        #theme-btn:hover { transform: scale(1.1); }
        table.latex-table { width: 100%; border-collapse: collapse; text-align: left; margin: 0 auto; font-size: 0.95em; }
        table.latex-table td { padding: 10px 15px; border-bottom: 1px solid var(--border-color); }
        table.latex-table tr:last-child td { border-bottom: none; }
        
        /* 👇 保证 Markdown 模式下的段落排版正确 👇 */
        #preview p { text-align: justify; text-indent: 2em; }
    </style>
</head>
<body>
    <div id="preview" contenteditable="true"></div>
    
    <div id="zoom-ctrl" style="position: fixed; bottom: 85px; right: 30px; background: var(--bg-color); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 20px; padding: 5px 15px; display: flex; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 9999; font-family: monospace;">
        <span style="font-size: 18px; cursor: pointer; user-select: none; padding: 0 8px; font-weight: bold;" id="zoom-out">-</span>
        <span style="font-size: 14px; min-width: 45px; text-align: center; user-select: none;" id="zoom-text">100%</span>
        <span style="font-size: 18px; cursor: pointer; user-select: none; padding: 0 8px; font-weight: bold;" id="zoom-in">+</span>
    </div>
    <button id="theme-btn" title="切换专注模式">🌓</button>

    <script>
        const vscode = acquireVsCodeApi();
        const preview = document.getElementById('preview');
        let currentLang = 'markdown'; 

        window.addEventListener('message', event => {
            if (event.data.command === 'renderFull') {
                currentLang = event.data.languageId || 'markdown';
                preview.setAttribute('contenteditable', currentLang === 'markdown' ? 'true' : 'false');
                renderMarkdown(event.data.text);
            }
        }); 

        const themeBtn = document.getElementById('theme-btn');
        if (localStorage.getItem('mathlive-theme') === 'dark') { document.body.classList.add('dark-mode'); }
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('mathlive-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });

        // 👇 缩放逻辑：挂载在 body 上，绝对不会因为打字刷新被重置 👇
        let currentZoom = 100;
        const zoomText = document.getElementById('zoom-text');
        document.getElementById('zoom-in').addEventListener('click', () => updateZoom(10));
        document.getElementById('zoom-out').addEventListener('click', () => updateZoom(-10));
        function updateZoom(delta) {
            currentZoom = Math.max(50, Math.min(300, currentZoom + delta));
            zoomText.innerText = currentZoom + '%';
            document.body.style.fontSize = (16 * currentZoom / 100) + 'px';
        }

        function beautifyLatex(latex) {
            if (!latex) return '';
            let step1 = latex.replace(/\\\\\\\\/g, '\\\\\\\\\\n    ').replace(/(\\\\begin{[^}]+}(?:{[^}]+})?)/g, '\\n$1\\n').replace(/(\\\\end{[^}]+})/g, '\\n$1\\n').replace(/(\\\\left(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n').replace(/(\\\\right(?:\\\\.|[^a-zA-Z0-9]))/g, '\\n$1\\n');
            let lines = step1.split('\\n').map(l => l.trim()).filter(l => l);
            let result = [];
            let indent = 0;
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (line.match(/^\\\\end{/) || line.match(/^\\\\right/)) { indent = Math.max(0, indent - 1); }
                result.push('    '.repeat(indent) + line);
                if (line.match(/^\\\\begin{/) || line.match(/^\\\\left/)) { indent++; }
            }
            let finalStr = result.join('\\n');
            finalStr = finalStr.replace(/([^\\n]+)\\n\\s*(\\\\left)/g, '$1 $2');
            finalStr = finalStr.replace(/(\\\\right[^\\n]+)\\n\\s*(\\\\tag)/g, '$1 $2');
            return finalStr;
        }

        const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        turndownService.escape = function (string) { return string; };

        let scrollSyncTimer;

        window.addEventListener('message', event => {
            if (event.data.command === 'updateMathOnly') {
                event.data.changes.forEach(change => {
                    const mf = document.querySelector(\`math-field[data-index="\${change.index}"]\`);
                    if (mf && mf.getValue() !== change.latex) {
                        mf.setValue(change.latex, { suppressChangeNotifications: true });
                        mf.removeAttribute('data-dirty');
                        const wrapper = mf.closest('.math-wrapper');
                        if (wrapper) wrapper.setAttribute('data-raw', encodeURIComponent(change.latex));
                    }
                });
            }
            if (event.data.command === 'focusMath') {
                document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
                const mf = document.querySelector(\`math-field[data-index="\${event.data.index}"]\`);
                if (mf) {
                    mf.classList.add('active-math');
                    const rect = mf.getBoundingClientRect();
                    if(rect.top < 0 || rect.bottom > window.innerHeight) mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            if (event.data.command === 'blurMath') { document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math')); }
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
                            if(rect.top < 0 || rect.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            break;
                        }
                    }
                }, 100); 
            }
        });

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
            vscode.postMessage({ command: 'editFullText', text: mdText.replace(/\\u200B/g, '') });
            renderMarkdown(mdText);
        }

        let textEditTimer;
        preview.addEventListener('input', (e) => {
            if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;
            if (currentLang === 'latex') return; 
            const sel = window.getSelection();
            if (sel && sel.focusNode && sel.focusNode.nodeType === Node.TEXT_NODE) {
                if (/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$)./.test(sel.focusNode.textContent)) {
                    renderAndRestoreCursor();
                    return; 
                }
            }
            clearTimeout(textEditTimer);
            textEditTimer = setTimeout(() => {
                const markdownText = turndownService.turndown(preview);
                vscode.postMessage({ command: 'editFullText', text: markdownText });
            }, 400); 
        });

        preview.addEventListener('click', (e) => {
            if (e.altKey) {
                if (e.target.closest('math-field') || e.target.closest('.math-wrapper')) return;
                const block = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
                if (block) {
                    const mdText = turndownService.turndown(block).trim();
                    vscode.postMessage({ command: 'syncTextToEditor', text: mdText });
                }
            }
        });

        function renderMarkdown(text) {
            const mathBlocks = [];

            const tempText = text.replace(/(\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+?\\$|\\\\\\[[\\s\\S]*?\\\\\\]|\\\\\\(.*?\\\\\\)|\\\\begin\\{(?:equation|align|gather|eqnarray|multline|alignat)\\*?\\}[\\s\\S]*?\\\\end\\{(?:equation|align|gather|eqnarray|multline|alignat)\\*?\\})/g, (match) => {
                const isBlock = match.startsWith('$$') || match.startsWith('\\\\[') || match.startsWith('\\\\begin');
                let inner = match;
                if (match.startsWith('$$')) inner = match.slice(2, -2);
                else if (match.startsWith('\\\\[')) inner = match.slice(2, -2);
                else if (match.startsWith('\\\\(')) inner = match.slice(2, -2);
                else if (match.startsWith('$')) inner = match.slice(1, -1);

                mathBlocks.push({ isBlock, inner: inner }); 
                return \`%%%MATH_\${mathBlocks.length - 1}%%%\`;
            });

            let html = '';
            if (typeof currentLang !== 'undefined' && currentLang === 'latex') {
                const macros = {};
                let fullText = tempText;
                fullText = fullText.replace(/\\\\newcommand\\{\\\\([a-zA-Z0-9_]+)\\}\\s*\\{([\\s\\S]*?)\\}/g, (match, name, value) => {
                    macros[name] = value; return ''; 
                });
                for (const [name, value] of Object.entries(macros)) {
                    const macroRegex = new RegExp('\\\\\\\\' + name + '(?![a-zA-Z])', 'g');
                    fullText = fullText.replace(macroRegex, value);
                }

                let bodyText = fullText;
                const docMatch = bodyText.match(/\\\\begin\\{document\\}([\\s\\S]*?)(?:\\\\end\\{document\\}|$)/);
                if (docMatch) bodyText = docMatch[1];
                else {
                    bodyText = bodyText.replace(/\\\\documentclass(?:\\[[^\\]]*\\])?\\{[^}]*\\}/g, '');
                    bodyText = bodyText.replace(/\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\}/g, '');
                }

                bodyText = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                bodyText = bodyText.replace(/\\\\resizebox\\{[^}]*\\}\\{[^}]*\\}\\{\\s*([\\s\\S]*?)\\s*\\}/g, '$1');
                
                bodyText = bodyText.replace(/\\\\begin\\{frame\\}\\{([^}]+)\\}/g, '<div class="beamer-slide"><div class="beamer-frametitle">$1</div>');
                bodyText = bodyText.replace(/\\\\begin\\{frame\\}/g, '<div class="beamer-slide">');
                bodyText = bodyText.replace(/\\\\end\\{frame\\}/g, '</div>');
                bodyText = bodyText.replace(/\\\\frametitle\\{([^}]+)\\}/g, '<div class="beamer-frametitle">$1</div>');
                bodyText = bodyText.replace(/\\\\frame\\{\\\\titlepage\\}/g, '<div class="beamer-slide"><div style="text-align:center; font-size:1.5em; font-weight:bold; color:var(--beamer-primary); padding:40px 0;">封面 (Title Page)</div></div>');

                // 👇 参考文献解析逻辑 👇
                bodyText = bodyText.replace(/\\\\begin\\{thebibliography\\}\\{[^}]*\\}([\\s\\S]*?)\\\\end\\{thebibliography\\}/g, (match, bibContent) => {
                    let htmlItems = [];
                    let count = 1;
                    let regex = /\\\\bibitem\\{[^}]*\\}([\\s\\S]*?)(?=\\\\bibitem\\{[^}]*\\}|$)/g;
                    let m;
                    while ((m = regex.exec(bibContent)) !== null) {
                        let itemText = m[1].replace(/%.*/g, '').trim();
                        htmlItems.push('<div style="margin-bottom: 0.5em; text-indent: 0;">[' + (count++) + '] ' + itemText + '</div>');
                    }
                    return '<div style="margin-top: 2em;"><h2 style="text-indent: 0; font-weight: bold; border-bottom: 2px solid var(--border-color); padding-bottom: 5px; margin-top: 1.5em;">参考文献</h2>' + htmlItems.join('') + '</div>';
                });

                bodyText = bodyText.replace(/\\\\begin\\{(?:itemize|enumerate)\\}([\\s\\S]*?)\\\\end\\{(?:itemize|enumerate)\\}/g, (match, listContent) => {
                    let items = listContent.split(/\\\\item/).filter(i => i.trim());
                    let htmlItems = items.map(item => \`<li>\${item.trim()}</li>\`).join('');
                    return \`<ul>\${htmlItems}</ul>\`;
                });

                bodyText = bodyText.replace(/\\\\begin\\{table\\}(?:\\[[^\\]]*\\])?([\\s\\S]*?)\\\\end\\{table\\}/g, (match, tableContent) => {
                    let caption = '';
                    tableContent = tableContent.replace(/\\\\caption\\{([^}]+)\\}/, (m, c) => { caption = c; return ''; });
                    tableContent = tableContent.replace(/\\\\centering/g, ''); 
                    let tabularHtml = '';
                    tableContent.replace(/\\\\begin\\{tabular\\}\\{[^}]*\\}([\\s\\S]*?)\\\\end\\{tabular\\}/, (m, tabContent) => {
                        tabContent = tabContent.replace(/\\\\(?:toprule|midrule|bottomrule|hline)/g, '');
                        let rows = tabContent.split(/\\\\\\\\/);
                        let htmlRows = rows.map(row => {
                            if (!row.trim()) return '';
                            let cells = row.split('&amp;').map(cell => \`<td>\${cell.trim()}</td>\`);
                            return \`<tr>\${cells.join('')}</tr>\`;
                        }).join('');
                        tabularHtml = \`<table class="latex-table">\${htmlRows}</table>\`;
                        return '';
                    });
                    return \`<div style="margin: 2em 0; overflow-x: auto; padding: 20px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bq-bg); box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        \${caption ? \`<div style="text-align: center; font-weight: bold; margin-bottom: 15px; font-size: 1.1em; color: var(--text-color);">\${caption}</div>\` : ''}
                        \${tabularHtml}
                    </div>\`;
                });

                bodyText = bodyText.replace(/\\\\(?:vspace|hspace)\\*?\\{[^}]*\\}/g, ''); 
                bodyText = bodyText.replace(/\\\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\\b/g, ''); 
                bodyText = bodyText.replace(/\\\\(?:zihao)\\{[^}]*\\}/g, ''); 
                bodyText = bodyText.replace(/\\\\(?:heiti|songti|kaishu|fangsong|bfseries|itshape)\\b/g, ''); 
                bodyText = bodyText.replace(/\\\\(?:newpage|noindent|vfill|today)\\b/g, ''); 
                bodyText = bodyText.replace(/\\\\thispagestyle\\{[^}]*\\}/g, ''); 
                bodyText = bodyText.replace(/\\\\pagenumbering\\{[^}]*\\}/g, '');
                bodyText = bodyText.replace(/\\\\par\\b/g, '<br>');
                
                bodyText = bodyText.replace(/\\\\fbox\\{([\\s\\S]*?)\\}/g, '<div style="border: 2px solid var(--border-color); padding: 1.5em; margin: 1em auto; display: inline-block;">$1</div>');
                bodyText = bodyText.replace(/\\\\parbox\\{[^}]*\\}\\{([\\s\\S]*?)\\}/g, '$1');
                bodyText = bodyText.replace(/\\\\begin\\{titlepage\\}/g, '<div style="margin-bottom: 3em; text-align: center;">');
                bodyText = bodyText.replace(/\\\\end\\{titlepage\\}/g, '</div>');

                bodyText = bodyText.replace(/\\\\maketitle/g, '');
                bodyText = bodyText.replace(/\\\\begin\\{center\\}([\\s\\S]*?)\\\\end\\{center\\}/g, '<div style="text-align: center; text-indent: 0; font-weight: bold; margin: 1em 0;">$1</div>');
                bodyText = bodyText.replace(/\\\\\\\\/g, '<br>'); 
                bodyText = bodyText.replace(/\\\\textbf\\{([^}]+)\\}/g, '<strong>$1</strong>');
                bodyText = bodyText.replace(/\\\\textit\\{([^}]+)\\}/g, '<em>$1</em>');
                bodyText = bodyText.replace(/\\\\textcolor\\{[^}]+\\}\\{([^}]+)\\}/g, '<span style="color: var(--beamer-primary);">$1</span>');
                
                bodyText = bodyText.replace(/\\\\section\\{([^}]+)\\}/g, '<h2 style="text-indent: 0; font-weight: bold; border-bottom: 2px solid var(--border-color); padding-bottom: 5px; margin-top: 1.5em;">$1</h2>');
                bodyText = bodyText.replace(/\\\\subsection\\{([^}]+)\\}/g, '<h3 style="text-indent: 0; font-weight: bold; margin-top: 1.2em;">$1</h3>');
                bodyText = bodyText.replace(/\\\\subsubsection\\{([^}]+)\\}/g, '<h4 style="text-indent: 0; font-weight: bold; margin-top: 1em;">$1</h4>');
                bodyText = bodyText.replace(/\\\\textsuperscript\\{([^}]+)\\}/g, '<sup>$1</sup>');
                bodyText = bodyText.replace(/\\\\dots\\b/g, '...'); 

                // 👇 严格使用单引号拼接，绕开模板转义陷阱，保证段落两端对齐及缩进 👇
                const paragraphs = bodyText.split(/[\\r\\n]+\\s*[\\r\\n]+/);
                html = paragraphs.map(p => {
                    let trimP = p.trim();
                    if (!trimP) return '';
                    if (trimP.startsWith('<div') || trimP.startsWith('<h') || trimP.startsWith('<ul') || trimP.startsWith('<ol')) return trimP;
                    return '<p style="margin: 0.8em 0; text-align: justify; text-indent: 2em;">' + trimP + '</p>';
                }).join('\\n');

            } else {
                html = marked.parse(tempText);
            }

            html = html.replace(/%%%MATH_(\\d+)%%%/g, (_match, p1) => {
                const index = parseInt(p1, 10);
                const block = mathBlocks[index];
                const cls = block.isBlock ? 'block-math' : 'inline-math';
                const encodedRaw = encodeURIComponent(block.inner);
                return \`<span class="math-wrapper \${cls}" data-index="\${index}" data-raw="\${encodedRaw}"></span>\`;
            });

            const tempDiv = document.createElement('div');
            tempDiv.id = 'preview';
            tempDiv.setAttribute('contenteditable', preview.getAttribute('contenteditable'));
            tempDiv.innerHTML = html;

            morphdom(preview, tempDiv, {
                onBeforeElUpdated: function(fromEl, toEl) {
                    if (fromEl.classList && fromEl.classList.contains('math-wrapper')) {
                        if (fromEl.getAttribute('data-raw') === toEl.getAttribute('data-raw')) {
                            return false; 
                        }
                    }
                    return true;
                }
            });

            preview.querySelectorAll('.math-wrapper').forEach(wrapper => {
                if (!wrapper.querySelector('math-field')) {
                    const index = wrapper.getAttribute('data-index');
                    let raw = decodeURIComponent(wrapper.getAttribute('data-raw'));
                    raw = raw.replace(/\\s+/g, ' ').replace(/\\\\dots\\b/g, '\\\\ldots');

                    const mf = document.createElement('math-field');
                    mf.setAttribute('virtual-keyboard-mode', 'onfocus');
                    mf.dataset.index = index;
                    mf.setValue(raw, { suppressChangeNotifications: true });
                    wrapper.appendChild(mf);
                    
                    const send = () => {
                        mf.setAttribute('data-dirty', 'true');
                        let latex = mf.getValue();
                        const isBlock = mf.closest('.math-wrapper').classList.contains('block-math');
                        if (isBlock && !latex.startsWith('\\\\begin')) {
                            latex = beautifyLatex(latex);
                        }
                        vscode.postMessage({ command: 'editMath', index: Number(index), latex: latex });
                    };

                    mf.addEventListener('input', send);
                    mf.addEventListener('focusin', () => {
                        document.querySelectorAll('math-field').forEach(el => el.classList.remove('active-math'));
                        vscode.postMessage({ command: 'focusEditor', index: Number(index) });
                    });
                }
            });
        }
    </script>
</body>
</html>`;
}