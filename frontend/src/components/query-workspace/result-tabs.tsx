import { createSignal, Show, type JSX } from "solid-js";
import type { QueryResponse, QueryDiagramResponse } from "~/lib/types";
import ResultTable from "./result-table";
import ExecutionDiagram from "./execution-diagram";

type Tab = "results" | "execution";

interface ResultTabsProps {
	result: QueryResponse | null;
	diagram: QueryDiagramResponse | null;
	loading: boolean;
}

export default function ResultTabs(props: ResultTabsProps) {
	const [activeTab, setActiveTab] = createSignal<Tab>("results");

	return (
		<div class="flex flex-col h-full overflow-hidden">
			{/* Tab bar */}
			<div
				class="flex items-center gap-0 border-b shrink-0"
				style={{
					"border-color": "var(--border)",
					"background-color": "var(--bg-secondary)",
				}}
			>
				<TabButton
					label="Results"
					active={activeTab() === "results"}
					onClick={() => setActiveTab("results")}
					icon={
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							<line x1="3" y1="9" x2="21" y2="9" />
							<line x1="9" y1="3" x2="9" y2="21" />
						</svg>
					}
				/>
				<TabButton
					label="Execution Flow"
					active={activeTab() === "execution"}
					onClick={() => setActiveTab("execution")}
					icon={
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
						</svg>
					}
				/>
			</div>

			{/* Tab content */}
			<div class="flex-1 min-h-0">
				<Show when={activeTab() === "results"}>
					<ResultTable result={props.result} loading={props.loading} />
				</Show>
				<Show when={activeTab() === "execution"}>
					<ExecutionDiagram diagram={props.diagram} loading={props.loading} />
				</Show>
			</div>
		</div>
	);
}

function TabButton(props: {
	label: string;
	active: boolean;
	onClick: () => void;
	icon: JSX.Element;
}) {
	return (
		<button
			type="button"
			onClick={props.onClick}
			class="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors relative"
			style={{
				color: props.active ? "var(--accent)" : "var(--text-muted)",
				"background-color": "transparent",
			}}
		>
			<span style={{ opacity: props.active ? 1 : 0.6 }}>{props.icon}</span>
			{props.label}
			{/* Active underline */}
			<Show when={props.active}>
				<div
					class="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
					style={{ "background-color": "var(--accent)" }}
				/>
			</Show>
		</button>
	);
}
