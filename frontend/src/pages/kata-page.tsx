import { createResource, createSignal, createMemo, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { fetchKata, executeQuery } from "~/lib/api-client";
import type { QueryResponse } from "~/lib/types";
import MarkdownContent from "~/components/markdown-content/markdown-content";
import SqlEditor from "~/components/query-workspace/sql-editor";
import ResultTable from "~/components/query-workspace/result-table";

const MIN_PANEL_PCT = 20;
const DEFAULT_CODE_PCT = 40;

export default function KataPage() {
	const params = useParams();

	const [kata] = createResource(
		() => params.kataId,
		(id) => fetchKata(id),
	);

	const [result, setResult] = createSignal<QueryResponse | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [codePanelPct, setCodePanelPct] = createSignal(DEFAULT_CODE_PCT);
	const [maximized, setMaximized] = createSignal(false);
	const [dragging, setDragging] = createSignal(false);

	let containerRef: HTMLDivElement | undefined;

	const handleExecute = async (query: string) => {
		setLoading(true);
		try {
			const res = await executeQuery(query);
			setResult(res);
		} catch (error) {
			setResult({ success: false, error: String(error), rows: [], columns: [] });
		} finally {
			setLoading(false);
		}
	};

	const markdownContent = createMemo(() => {
		const k = kata();
		if (!k) return "";

		const sections: string[] = [];

		if (k.description) {
			sections.push(k.description);
		}
		if (k.schemaOverview) {
			sections.push(`## Schema Overview\n\n${k.schemaOverview}`);
		}
		if (k.reasoning) {
			sections.push(`## Step-by-Step Reasoning\n\n${k.reasoning}`);
		}
		if (k.solution) {
			sections.push(
				`## Solution\n\n\`\`\`sql\n${k.solution}\n\`\`\`\n\n${k.solutionExplanation}`,
			);
		}
		if (k.alternativeSolutions) {
			sections.push(`## Alternative Solutions\n\n${k.alternativeSolutions}`);
		}

		return sections.join("\n\n---\n\n");
	});

	// Reset results when navigating to a different kata
	createMemo(() => {
		const _id = params.kataId;
		setResult(null);
		setLoading(false);
	});

	const startDrag = (e: MouseEvent) => {
		e.preventDefault();
		setDragging(true);

		const onMove = (ev: MouseEvent) => {
			if (!containerRef) return;
			const rect = containerRef.getBoundingClientRect();
			const pct = ((rect.right - ev.clientX) / rect.width) * 100;
			setCodePanelPct(Math.min(100 - MIN_PANEL_PCT, Math.max(MIN_PANEL_PCT, pct)));
		};

		const onUp = () => {
			setDragging(false);
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div
			ref={containerRef}
			class="flex flex-1 overflow-hidden relative"
			style={{ cursor: dragging() ? "col-resize" : "auto" }}
		>
			{/* Loading */}
			<Show when={kata.loading}>
				<div class="flex-1 flex items-center justify-center">
					<span style={{ color: "var(--text-muted)" }}>Loading kata...</span>
				</div>
			</Show>

			{/* Error */}
			<Show when={kata.error}>
				<div class="flex-1 flex items-center justify-center">
					<span style={{ color: "var(--error)" }}>Failed to load kata.</span>
				</div>
			</Show>

			{/* Content */}
			<Show when={kata()} keyed>
				{(k) => (
					<>
						{/* Left panel — markdown content */}
						<Show when={!maximized()}>
							<div
								class="overflow-y-auto border-r"
								style={{
									"border-color": "var(--border)",
									"min-width": "0",
									width: `${100 - codePanelPct()}%`,
								}}
							>
								<div class="max-w-3xl p-6">
									<div class="mb-2 flex items-center gap-3">
										<span
											class="text-xs px-2 py-0.5 rounded-full font-medium"
											style={{
												"background-color": "var(--accent-light)",
												color: "var(--accent)",
											}}
										>
											Phase {k.phase}
										</span>
										<span
											class="text-xs"
											style={{ color: "var(--text-muted)" }}
										>
											{k.phaseTitle}
										</span>
									</div>
									<h1
										class="text-2xl font-bold mb-6"
										style={{ color: "var(--text-primary)" }}
									>
										{k.sequence}. {k.title}
									</h1>
									<MarkdownContent source={markdownContent()} />
								</div>
							</div>

							{/* Resize handle */}
							<div
								class="shrink-0 flex items-center justify-center cursor-col-resize transition-colors hover:bg-[var(--accent-light)]"
								style={{
									width: "5px",
									"background-color": dragging()
										? "var(--accent-light)"
										: "var(--border)",
								}}
								onMouseDown={startDrag}
							/>
						</Show>

						{/* Right panel — SQL editor + results */}
						<div
							class="flex flex-col"
							style={{
								width: maximized() ? "100%" : `${codePanelPct()}%`,
								"min-width": maximized() ? "0" : "300px",
							}}
						>
							{/* Panel controls */}
							<div
								class="flex items-center justify-end px-2 py-1 border-b shrink-0 gap-1"
								style={{
									"border-color": "var(--border)",
									"background-color": "var(--bg-secondary)",
								}}
							>
								<Show when={maximized()}>
									<span
										class="text-xs mr-auto px-2 font-medium"
										style={{ color: "var(--text-muted)" }}
									>
										{k.sequence}. {k.title}
									</span>
								</Show>
								<button
									type="button"
									onClick={() => setMaximized((m) => !m)}
									class="p-1 rounded transition-colors"
									style={{ color: "var(--text-muted)" }}
									title={maximized() ? "Restore panel" : "Maximize panel"}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor =
											"var(--bg-tertiary)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = "transparent";
									}}
								>
									<Show
										when={maximized()}
										fallback={
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
											</svg>
										}
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
										</svg>
									</Show>
								</button>
							</div>

							<div
								class="flex-1 min-h-0 border-b"
								style={{ "border-color": "var(--border)" }}
							>
								<SqlEditor
									initialCode={
										k.starterSql || "SELECT * FROM customers LIMIT 10;"
									}
									onExecute={handleExecute}
								/>
							</div>
							<div class="flex-1 min-h-0">
								<ResultTable result={result()} loading={loading()} />
							</div>
						</div>
					</>
				)}
			</Show>
		</div>
	);
}
