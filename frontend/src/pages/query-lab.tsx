import { createSignal, Show } from "solid-js";
import SqlEditor from "../components/query-workspace/sql-editor";
import ResultTable from "../components/query-workspace/result-table";
import ThemeToggle from "../components/layout/theme-toggle";
import { executeQuery, resetDataset } from "../lib/api-client";
import type { QueryResponse } from "../lib/types";

export default function QueryLab() {
	const [result, setResult] = createSignal<QueryResponse | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [resetting, setResetting] = createSignal(false);
	const [resetMessage, setResetMessage] = createSignal<string | null>(null);

	const handleExecute = async (query: string) => {
		setLoading(true);
		setResetMessage(null);
		try {
			const res = await executeQuery(query);
			setResult(res);
		} catch (error) {
			setResult({ success: false, error: String(error), rows: [], columns: [] });
		} finally {
			setLoading(false);
		}
	};

	const handleReset = async () => {
		setResetting(true);
		setResetMessage(null);
		try {
			const res = await resetDataset();
			if (res.success) {
				setResetMessage("Dataset reset successfully.");
				setResult(null);
			} else {
				setResetMessage(`Reset failed: ${res.error}`);
			}
		} catch (error) {
			setResetMessage(`Reset failed: ${String(error)}`);
		} finally {
			setResetting(false);
			setTimeout(() => setResetMessage(null), 3000);
		}
	};

	return (
		<div
			class="flex flex-col h-screen"
			style={{ "background-color": "var(--bg-primary)" }}
		>
			{/* Top bar */}
			<div
				class="flex items-center justify-between px-4 py-2 border-b shrink-0"
				style={{
					"border-color": "var(--border)",
					"background-color": "var(--bg-secondary)",
				}}
			>
				<a
					href="/"
					class="flex items-center gap-2 text-sm font-bold no-underline transition-colors"
					style={{ color: "var(--text-primary)" }}
				>
					<span class="text-lg">🥋</span>
					SQL Katas
				</a>
				<div class="flex items-center gap-3">
					<Show when={resetMessage()}>
						<span
							class="text-xs px-2 py-1 rounded"
							style={{
								color: resetMessage()!.includes("failed")
									? "var(--error)"
									: "var(--success)",
								"background-color": resetMessage()!.includes("failed")
									? "color-mix(in srgb, var(--error) 10%, transparent)"
									: "color-mix(in srgb, var(--success) 10%, transparent)",
							}}
						>
							{resetMessage()}
						</span>
					</Show>
					<button
						onClick={handleReset}
						disabled={resetting()}
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 disabled:opacity-50"
						style={{
							"border-color": "var(--border)",
							color: "var(--text-secondary)",
							"background-color": "var(--bg-primary)",
						}}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class={resetting() ? "animate-spin" : ""}
						>
							<polyline points="23 4 23 10 17 10" />
							<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
						</svg>
						{resetting() ? "Resetting..." : "Reset Dataset"}
					</button>
					<ThemeToggle />
				</div>
			</div>

			{/* Editor (top half) */}
			<div
				class="flex-1 min-h-0 border-b"
				style={{ "border-color": "var(--border)" }}
			>
				<SqlEditor onExecute={handleExecute} />
			</div>

			{/* Results (bottom half) */}
			<div class="flex-1 min-h-0">
				<ResultTable result={result()} loading={loading()} />
			</div>
		</div>
	);
}
