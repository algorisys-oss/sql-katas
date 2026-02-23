import { For, Show } from "solid-js";
import type { QueryResponse } from "~/lib/types";

interface ResultTableProps {
	result: QueryResponse | null;
	loading: boolean;
}

export default function ResultTable(props: ResultTableProps) {
	return (
		<div class="flex flex-col h-full overflow-hidden">
			{/* Header */}
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
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
						<line x1="3" y1="9" x2="21" y2="9" />
						<line x1="3" y1="15" x2="21" y2="15" />
						<line x1="9" y1="3" x2="9" y2="21" />
						<line x1="15" y1="3" x2="15" y2="21" />
					</svg>
					<span
						class="text-xs font-semibold tracking-wide uppercase"
						style={{ color: "var(--text-muted)" }}
					>
						Results
					</span>
				</div>
				<Show when={props.result?.success}>
					<div class="flex items-center gap-2">
						<span
							class="text-xs px-2 py-0.5 rounded-full font-medium"
							style={{
								"background-color": "var(--accent-light)",
								color: "var(--accent)",
							}}
						>
							{(props.result as { rowCount: number }).rowCount} rows
						</span>
						<Show when={(props.result as { limited: boolean }).limited}>
							<span
								class="text-xs px-2 py-0.5 rounded-full font-medium"
								style={{
									"background-color": "var(--badge-bg)",
									color: "var(--warning)",
								}}
							>
								limited
							</span>
						</Show>
					</div>
				</Show>
			</div>

			{/* Content */}
			<div class="flex-1 overflow-auto">
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
							Running query...
						</span>
					</div>
				</Show>

				{/* Error */}
				<Show when={!props.loading && props.result && !props.result.success}>
					<div class="p-4">
						<div
							class="rounded-lg border p-4"
							style={{
								"border-color": "var(--error)",
								"background-color": "color-mix(in srgb, var(--error) 8%, transparent)",
							}}
						>
							<div class="flex items-center gap-2 mb-2">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									style={{ color: "var(--error)" }}
								>
									<circle cx="12" cy="12" r="10" />
									<line x1="15" y1="9" x2="9" y2="15" />
									<line x1="9" y1="9" x2="15" y2="15" />
								</svg>
								<span
									class="text-sm font-semibold"
									style={{ color: "var(--error)" }}
								>
									Query Error
								</span>
							</div>
							<pre
								class="text-xs whitespace-pre-wrap font-mono leading-relaxed"
								style={{ color: "var(--text-secondary)" }}
							>
								{(props.result as { error: string }).error}
							</pre>
						</div>
					</div>
				</Show>

				{/* Data */}
				<Show
					when={
						!props.loading &&
						props.result?.success &&
						(props.result as { rows: unknown[] }).rows.length > 0
					}
				>
					<table class="w-full text-xs border-collapse">
						<thead>
							<tr>
								<For each={(props.result as { columns: string[] }).columns}>
									{(col) => (
										<th
											class="text-left px-4 py-2.5 border-b font-semibold sticky top-0 whitespace-nowrap"
											style={{
												"border-color": "var(--border)",
												"background-color": "var(--bg-secondary)",
												color: "var(--text-primary)",
											}}
										>
											{col}
										</th>
									)}
								</For>
							</tr>
						</thead>
						<tbody>
							<For each={(props.result as { rows: Record<string, unknown>[] }).rows}>
								{(row) => (
									<tr
										class="transition-colors duration-100"
										style={{ "--tw-bg-opacity": "1" }}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor =
												"var(--bg-tertiary)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "transparent";
										}}
									>
										<For
											each={
												(props.result as { columns: string[] }).columns
											}
										>
											{(col) => (
												<td
													class="px-4 py-2 border-b whitespace-nowrap font-mono"
													style={{
														"border-color": "var(--border)",
														color:
															row[col] === null
																? "var(--text-muted)"
																: "var(--text-primary)",
														"font-style":
															row[col] === null ? "italic" : "normal",
													}}
												>
													{row[col] === null ? "NULL" : String(row[col])}
												</td>
											)}
										</For>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</Show>

				{/* Empty */}
				<Show
					when={
						!props.loading &&
						props.result?.success &&
						(props.result as { rows: unknown[] }).rows.length === 0
					}
				>
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
							<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<span class="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
							Query returned no rows.
						</span>
					</div>
				</Show>

				{/* Placeholder */}
				<Show when={!props.loading && !props.result}>
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
							<polyline points="16 18 22 12 16 6" />
							<polyline points="8 6 2 12 8 18" />
						</svg>
						<span class="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
							Run a query to see results here.
						</span>
						<span
							class="mt-1 text-xs"
							style={{ color: "var(--text-muted)", opacity: 0.7 }}
						>
							Press Ctrl+Enter or click Run
						</span>
					</div>
				</Show>
			</div>
		</div>
	);
}
