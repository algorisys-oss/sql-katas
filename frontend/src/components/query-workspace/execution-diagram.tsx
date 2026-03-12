import { For, Show, createSignal, createMemo, onCleanup, onMount } from "solid-js";
import type { DiagramStep, QueryDiagramResponse } from "~/lib/types";

interface ExecutionDiagramProps {
	diagram: QueryDiagramResponse | null;
	loading: boolean;
}

const STEP_COLORS: Record<DiagramStep["type"], string> = {
	CTE: "#8b5cf6",      // violet
	FROM: "#3b82f6",     // blue
	JOIN: "#06b6d4",     // cyan
	WHERE: "#f59e0b",    // amber
	GROUP_BY: "#a855f7", // purple
	HAVING: "#ec4899",   // pink
	SELECT: "#10b981",   // emerald
	DISTINCT: "#14b8a6", // teal
	ORDER_BY: "#0ea5e9", // sky
	LIMIT: "#64748b",    // slate
};

const STEP_ORDER_LABELS: Record<DiagramStep["type"], string> = {
	CTE: "0",
	FROM: "1",
	JOIN: "1+",
	WHERE: "2",
	GROUP_BY: "3",
	HAVING: "4",
	SELECT: "5",
	DISTINCT: "6",
	ORDER_BY: "7",
	LIMIT: "8",
};

function formatRows(n: number | undefined): string {
	if (n === undefined) return "";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export default function ExecutionDiagram(props: ExecutionDiagramProps) {
	const [activeStep, setActiveStep] = createSignal<number | null>(null);
	const [playing, setPlaying] = createSignal(false);
	const [maximized, setMaximized] = createSignal(false);

	const steps = createMemo(() => props.diagram?.steps ?? []);

	// Close on Escape
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape" && maximized()) {
			setMaximized(false);
		}
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);
	});

	// Step-through animation
	let intervalId: ReturnType<typeof setInterval> | undefined;

	function startPlay() {
		setPlaying(true);
		setActiveStep(0);
		intervalId = setInterval(() => {
			setActiveStep((prev) => {
				const next = (prev ?? -1) + 1;
				if (next >= steps().length) {
					stopPlay();
					return null;
				}
				return next;
			});
		}, 1200);
	}

	function stopPlay() {
		setPlaying(false);
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = undefined;
		}
	}

	function resetPlay() {
		stopPlay();
		setActiveStep(null);
	}

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
		if (intervalId) clearInterval(intervalId);
	});

	const headerBar = () => (
		<div
			class="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
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
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
				</svg>
				<span
					class="text-xs font-semibold tracking-wide uppercase"
					style={{ color: "var(--text-muted)" }}
				>
					Execution Flow
				</span>
			</div>

			<div class="flex items-center gap-1">
				<Show when={steps().length > 0}>
					<button
						type="button"
						onClick={() => (playing() ? stopPlay() : startPlay())}
						class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
						style={{
							color: "var(--accent)",
							"background-color": "var(--accent-light)",
						}}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="currentColor"
							stroke="none"
						>
							<Show
								when={playing()}
								fallback={<polygon points="5 3 19 12 5 21 5 3" />}
							>
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</Show>
						</svg>
						{playing() ? "Pause" : "Play"}
					</button>
					<Show when={activeStep() !== null}>
						<button
							type="button"
							onClick={resetPlay}
							class="px-2 py-1 rounded text-xs font-medium transition-colors"
							style={{ color: "var(--text-muted)" }}
						>
							Reset
						</button>
					</Show>
				</Show>

				<button
					type="button"
					onClick={() => setMaximized((m) => !m)}
					class="p-1 rounded transition-colors ml-1"
					style={{ color: "var(--text-muted)" }}
					title={maximized() ? "Restore (Esc)" : "Maximize"}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
					}}
				>
					<Show
						when={maximized()}
						fallback={
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
							</svg>
						}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
						</svg>
					</Show>
				</button>
			</div>
		</div>
	);

	const stepsContent = () => (
		<div class="flex-1 overflow-auto p-4">
			{/* Loading */}
			<Show when={props.loading}>
				<div class="flex items-center gap-2 p-6">
					<div
						class="w-4 h-4 border-2 rounded-full animate-spin"
						style={{
							"border-color": "var(--border)",
							"border-top-color": "var(--accent)",
						}}
					/>
					<span class="text-sm" style={{ color: "var(--text-muted)" }}>
						Analyzing query...
					</span>
				</div>
			</Show>

			{/* Error */}
			<Show when={!props.loading && props.diagram && !props.diagram.success}>
				<div class="p-4">
					<div
						class="rounded-lg border p-4"
						style={{
							"border-color": "var(--error)",
							"background-color":
								"color-mix(in srgb, var(--error) 8%, transparent)",
						}}
					>
						<span class="text-sm" style={{ color: "var(--error)" }}>
							{props.diagram?.error}
						</span>
					</div>
				</div>
			</Show>

			{/* Steps */}
			<Show when={!props.loading && steps().length > 0}>
				<div class="flex flex-col gap-0 max-w-lg mx-auto">
					<For each={steps()}>
						{(step, index) => {
							const isActive = createMemo(() => activeStep() === index());
							const isPast = createMemo(() => {
								const a = activeStep();
								return a !== null && index() < a;
							});
							const dimmed = createMemo(() => {
								const a = activeStep();
								return a !== null && !isActive() && !isPast();
							});

							const color = STEP_COLORS[step.type];
							const rowStr = formatRows(step.estimatedRows);

							return (
								<>
									{/* Arrow connector */}
									<Show when={index() > 0}>
										<div class="flex justify-center">
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												stroke={dimmed() ? "var(--border)" : "var(--text-muted)"}
												stroke-width="2"
												style={{
													opacity: dimmed() ? 0.3 : 0.6,
													transition: "opacity 0.3s ease",
												}}
											>
												<line x1="12" y1="2" x2="12" y2="18" />
												<polyline points="8 14 12 18 16 14" />
											</svg>
										</div>
									</Show>

									{/* Step card */}
									<div
										class="flex items-stretch rounded-lg border transition-all duration-300"
										style={{
											"border-color": isActive() ? color : "var(--border)",
											"background-color": isActive()
												? `color-mix(in srgb, ${color} 8%, var(--bg-primary))`
												: "var(--bg-primary)",
											opacity: dimmed() ? 0.35 : 1,
											transform: isActive() ? "scale(1.02)" : "scale(1)",
											"box-shadow": isActive()
												? `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`
												: "none",
										}}
										onMouseEnter={() => {
											if (!playing()) setActiveStep(index());
										}}
										onMouseLeave={() => {
											if (!playing()) setActiveStep(null);
										}}
									>
										{/* Left color stripe + step number */}
										<div
											class="flex flex-col items-center justify-center px-3 rounded-l-lg shrink-0"
											style={{
												"background-color": `color-mix(in srgb, ${color} 15%, transparent)`,
												"min-width": "44px",
											}}
										>
											<span class="text-xs font-bold" style={{ color }}>
												{STEP_ORDER_LABELS[step.type]}
											</span>
										</div>

										{/* Main content */}
										<div class="flex-1 px-3 py-2.5 min-w-0">
											<div class="flex items-center gap-2 mb-0.5">
												<span
													class="text-xs font-bold uppercase tracking-wide"
													style={{ color }}
												>
													{step.type.replace("_", " ")}
												</span>
												<Show when={rowStr}>
													<span
														class="text-xs px-1.5 py-0.5 rounded-full font-mono font-medium"
														style={{
															"background-color": "var(--badge-bg)",
															color: "var(--badge-text)",
														}}
													>
														{rowStr} rows
													</span>
												</Show>
											</div>
											<div
												class="text-xs font-mono truncate"
												style={{ color: "var(--text-secondary)" }}
												title={step.label}
											>
												{step.label}
											</div>
											<Show when={isActive()}>
												<div
													class="text-xs mt-1"
													style={{ color: "var(--text-muted)" }}
												>
													{step.description}
												</div>
											</Show>
										</div>
									</div>
								</>
							);
						}}
					</For>
				</div>
			</Show>

			{/* Placeholder */}
			<Show when={!props.loading && !props.diagram}>
				<div class="flex flex-col items-center justify-center p-12">
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						style={{ color: "var(--text-muted)" }}
					>
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
					</svg>
					<span class="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
						Run a query to see its execution flow.
					</span>
					<span
						class="mt-1 text-xs"
						style={{ color: "var(--text-muted)", opacity: 0.7 }}
					>
						Shows the logical steps SQL uses to process your query
					</span>
				</div>
			</Show>
		</div>
	);

	return (
		<>
			{/* Inline (default) view */}
			<Show when={!maximized()}>
				<div class="flex flex-col h-full overflow-hidden">
					{headerBar()}
					{stepsContent()}
				</div>
			</Show>

			{/* Maximized overlay */}
			<Show when={maximized()}>
				<div
					class="fixed inset-0 flex flex-col overflow-hidden"
					style={{
						"z-index": "50",
						"background-color": "var(--bg-primary)",
					}}
				>
					{headerBar()}
					{stepsContent()}
				</div>
			</Show>
		</>
	);
}
