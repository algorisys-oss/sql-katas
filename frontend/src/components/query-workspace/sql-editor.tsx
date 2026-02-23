import { createSignal } from "solid-js";
import { createCodeMirror } from "~/lib/create-codemirror";

interface SqlEditorProps {
	initialCode?: string;
	onExecute: (query: string) => void;
}

export default function SqlEditor(props: SqlEditorProps) {
	const defaultCode = () => props.initialCode || "SELECT * FROM customers LIMIT 10;";
	const [code, setCode] = createSignal(defaultCode());

	const { ref, setCode: setEditorCode } = createCodeMirror({
		code,
		onCodeChange: setCode,
		onCtrlEnter: () => props.onExecute(code()),
	});

	const handleRevert = () => {
		const starter = defaultCode();
		setCode(starter);
		setEditorCode(starter);
	};

	return (
		<div class="flex flex-col h-full">
			<div
				class="flex items-center justify-between px-4 py-2.5 border-b"
				style={{
					"border-color": "var(--border)",
					"background-color": "var(--bg-secondary)",
				}}
			>
				<div class="flex items-center gap-2">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						style={{ color: "var(--text-muted)" }}
					>
						<polyline points="16 18 22 12 16 6" />
						<polyline points="8 6 2 12 8 18" />
					</svg>
					<span class="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
						SQL Editor
					</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						onClick={handleRevert}
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 active:scale-95"
						style={{
							color: "var(--text-secondary)",
							"background-color": "var(--bg-tertiary)",
						}}
						title="Revert to starter code"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="1 4 1 10 7 10" />
							<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
						</svg>
						Revert
					</button>
					<button
						onClick={() => props.onExecute(code())}
						class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md text-white transition-all duration-150 hover:shadow-md active:scale-95"
						style={{ "background-color": "var(--accent)" }}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<polygon points="5 3 19 12 5 21 5 3" />
						</svg>
						Run
						<kbd
							class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono opacity-70"
							style={{
								"background-color": "rgba(255,255,255,0.2)",
							}}
						>
							Ctrl+Enter
						</kbd>
					</button>
				</div>
			</div>
			<div ref={ref} class="flex-1 overflow-auto" />
		</div>
	);
}
