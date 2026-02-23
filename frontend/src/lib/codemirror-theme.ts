import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const baseTheme = EditorView.theme({
	"&": {
		backgroundColor: "var(--panel-bg)",
		color: "var(--text-primary)",
		fontSize: "0.9rem",
		height: "100%",
	},
	".cm-content": {
		fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
		lineHeight: "1.6",
		padding: "16px 0",
		caretColor: "var(--text-primary)",
	},
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--text-primary)",
	},
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
		backgroundColor: "var(--accent-light) !important",
	},
	".cm-gutters": {
		backgroundColor: "var(--bg-secondary)",
		color: "var(--text-muted)",
		border: "none",
		borderRight: "1px solid var(--border)",
		fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
		fontSize: "0.8rem",
	},
	".cm-activeLineGutter": {
		backgroundColor: "var(--bg-tertiary)",
		color: "var(--text-secondary)",
	},
	".cm-activeLine": {
		backgroundColor: "var(--bg-tertiary)",
	},
	".cm-matchingBracket": {
		backgroundColor: "var(--accent-light)",
		outline: "1px solid var(--accent)",
	},
	".cm-foldPlaceholder": {
		backgroundColor: "var(--bg-tertiary)",
		color: "var(--text-muted)",
		border: "1px solid var(--border)",
	},
	"&.cm-focused": {
		outline: "none",
	},
	".cm-scroller": {
		overflow: "auto",
	},
	".cm-tooltip": {
		backgroundColor: "var(--card-bg)",
		border: "1px solid var(--border)",
		color: "var(--text-primary)",
	},
	".cm-tooltip-autocomplete": {
		"& > ul > li": {
			padding: "2px 8px",
		},
		"& > ul > li[aria-selected]": {
			backgroundColor: "var(--accent-light)",
			color: "var(--text-primary)",
		},
	},
});

const highlightStyle = HighlightStyle.define([
	{ tag: tags.keyword, color: "var(--accent)" },
	{ tag: tags.controlKeyword, color: "var(--accent)", fontWeight: "600" },
	{ tag: tags.operatorKeyword, color: "var(--accent)" },
	{ tag: tags.definitionKeyword, color: "var(--accent)" },
	{ tag: tags.moduleKeyword, color: "var(--accent)" },
	{
		tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))],
		color: "#dcdcaa",
	},
	{ tag: tags.string, color: "var(--success)" },
	{ tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
	{ tag: tags.number, color: "var(--warning)" },
	{ tag: tags.bool, color: "var(--warning)" },
	{ tag: tags.null, color: "var(--warning)" },
	{ tag: tags.operator, color: "var(--text-secondary)" },
	{ tag: tags.punctuation, color: "var(--text-secondary)" },
	{ tag: tags.className, color: "#4ec9b0" },
	{ tag: tags.definition(tags.variableName), color: "#9cdcfe" },
	{ tag: tags.variableName, color: "var(--text-primary)" },
	{ tag: tags.propertyName, color: "#9cdcfe" },
	{ tag: tags.self, color: "var(--accent)" },
	{ tag: tags.typeName, color: "#4ec9b0" },
	{ tag: tags.special(tags.string), color: "var(--success)" },
]);

export const kataTheme: Extension = [baseTheme, syntaxHighlighting(highlightStyle)];
