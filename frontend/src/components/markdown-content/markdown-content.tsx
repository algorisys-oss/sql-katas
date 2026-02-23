import { createMemo } from "solid-js";
import "./markdown-content.css";

interface MarkdownContentProps {
	source: string;
}

function parseMarkdown(md: string): string {
	let html = md;

	// Step 1: Extract code blocks into placeholders so later regexes
	// cannot corrupt content inside them.
	const codeBlocks: string[] = [];
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
		const escaped = code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		const block = `<pre class="md-code-block"><code class="language-${lang}">${escaped}</code></pre>`;
		codeBlocks.push(block);
		return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
	});

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

	// Tables
	const tableBlocks: string[] = [];
	html = html.replace(
		/(^\|.+\|$\n^\|[\s:|-]+\|$\n(?:^\|.+\|$\n?)+)/gm,
		(tableMatch) => {
			const rows = tableMatch.trim().split("\n");
			const headers = rows[0]
				.split("|")
				.filter((c) => c.trim())
				.map((c) => `<th class="md-th">${c.trim()}</th>`)
				.join("");
			const bodyRows = rows.slice(2).map((row) => {
				const cells = row
					.split("|")
					.filter((c) => c.trim())
					.map((c) => `<td class="md-td">${c.trim()}</td>`)
					.join("");
				return `<tr>${cells}</tr>`;
			});
			const table = `<table class="md-table"><thead><tr>${headers}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`;
			tableBlocks.push(table);
			return `\n__TABLE_BLOCK_${tableBlocks.length - 1}__\n`;
		},
	);

	// Headers
	html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
	html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
	html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
	html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

	// Blockquotes
	html = html.replace(
		/^> (.+)$/gm,
		'<blockquote class="md-blockquote">$1</blockquote>',
	);

	// Horizontal rules
	html = html.replace(/^---$/gm, '<hr class="md-hr" />');

	// Bold and italic
	html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

	// Ordered lists
	html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-li">$1</li>');
	html = html.replace(
		/(<li class="md-li">[\s\S]*?<\/li>)(\n(?!<li)|\s*$)/g,
		'<ul class="md-ol">$1</ul>$2',
	);

	// Unordered lists
	html = html.replace(/^- (.+)$/gm, '<li class="md-li-ul">$1</li>');
	html = html.replace(
		/(<li class="md-li-ul">[\s\S]*?<\/li>)(\n(?!<li)|\s*$)/g,
		'<ul class="md-ul">$1</ul>$2',
	);

	// Paragraphs: wrap remaining non-tag, non-placeholder lines
	html = html.replace(
		/^(?!<[a-z/]|__CODE_BLOCK_|__TABLE_BLOCK_|$)(.+)$/gm,
		'<p class="md-p">$1</p>',
	);

	// Step 2: Restore placeholders
	html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_match, idx) => {
		return codeBlocks[Number.parseInt(idx)];
	});
	html = html.replace(/__TABLE_BLOCK_(\d+)__/g, (_match, idx) => {
		return tableBlocks[Number.parseInt(idx)];
	});

	return html;
}

export default function MarkdownContent(props: MarkdownContentProps) {
	const rendered = createMemo(() => parseMarkdown(props.source));

	return <div class="markdown-content" innerHTML={rendered()} />;
}
