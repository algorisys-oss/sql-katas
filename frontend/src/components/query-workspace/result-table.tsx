import { For, Show, createSignal, createMemo } from "solid-js";
import type { QueryResponse } from "~/lib/types";

interface ResultTableProps {
	result: QueryResponse | null;
	loading: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function ResultTable(props: ResultTableProps) {
	const [page, setPage] = createSignal(0);
	const [pageSize, setPageSize] = createSignal<number>(25);

	const allRows = createMemo(() => {
		if (props.result?.success) {
			return (props.result as { rows: Record<string, unknown>[] }).rows;
		}
		return [];
	});

	const totalRows = createMemo(() => allRows().length);
	const totalPages = createMemo(() => Math.max(1, Math.ceil(totalRows() / pageSize())));

	const pagedRows = createMemo(() => {
		const start = page() * pageSize();
		return allRows().slice(start, start + pageSize());
	});

	const rangeStart = createMemo(() => (totalRows() === 0 ? 0 : page() * pageSize() + 1));
	const rangeEnd = createMemo(() => Math.min((page() + 1) * pageSize(), totalRows()));

	// Reset to first page when result changes
	createMemo(() => {
		if (props.result) setPage(0);
	});

	function goFirst() {
		setPage(0);
	}
	function goPrev() {
		setPage((p) => Math.max(0, p - 1));
	}
	function goNext() {
		setPage((p) => Math.min(totalPages() - 1, p + 1));
	}
	function goLast() {
		setPage(totalPages() - 1);
	}

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
							<For each={pagedRows()}>
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

			{/* Pagination footer */}
			<Show when={!props.loading && props.result?.success && totalRows() > 0}>
				<div
					class="flex items-center justify-between px-4 py-2 border-t"
					style={{
						"border-color": "var(--border)",
						"background-color": "var(--bg-secondary)",
					}}
				>
					{/* Rows per page */}
					<div class="flex items-center gap-2">
						<span class="text-xs" style={{ color: "var(--text-muted)" }}>
							Rows per page
						</span>
						<select
							class="text-xs rounded px-1.5 py-1 border outline-none cursor-pointer"
							style={{
								"border-color": "var(--border)",
								"background-color": "var(--bg-primary)",
								color: "var(--text-primary)",
							}}
							value={pageSize()}
							onChange={(e) => {
								setPageSize(Number(e.currentTarget.value));
								setPage(0);
							}}
						>
							<For each={[...PAGE_SIZE_OPTIONS]}>
								{(size) => <option value={size}>{size}</option>}
							</For>
						</select>
					</div>

					{/* Range indicator */}
					<span class="text-xs" style={{ color: "var(--text-muted)" }}>
						{rangeStart()}–{rangeEnd()} of {totalRows()}
					</span>

					{/* Navigation */}
					<div class="flex items-center gap-1">
						<PaginationButton
							onClick={goFirst}
							disabled={page() === 0}
							title="First page"
						>
							<path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
						</PaginationButton>
						<PaginationButton
							onClick={goPrev}
							disabled={page() === 0}
							title="Previous page"
						>
							<path d="M15 19l-7-7 7-7" />
						</PaginationButton>
						<span
							class="text-xs px-2 tabular-nums"
							style={{ color: "var(--text-secondary)" }}
						>
							{page() + 1} / {totalPages()}
						</span>
						<PaginationButton
							onClick={goNext}
							disabled={page() >= totalPages() - 1}
							title="Next page"
						>
							<path d="M9 5l7 7-7 7" />
						</PaginationButton>
						<PaginationButton
							onClick={goLast}
							disabled={page() >= totalPages() - 1}
							title="Last page"
						>
							<path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
						</PaginationButton>
					</div>
				</div>
			</Show>
		</div>
	);
}

function PaginationButton(props: {
	onClick: () => void;
	disabled: boolean;
	title: string;
	children: unknown;
}) {
	return (
		<button
			type="button"
			onClick={props.onClick}
			disabled={props.disabled}
			title={props.title}
			class="p-1 rounded transition-colors"
			style={{
				color: props.disabled ? "var(--text-muted)" : "var(--text-secondary)",
				opacity: props.disabled ? 0.4 : 1,
				cursor: props.disabled ? "default" : "pointer",
			}}
			onMouseEnter={(e) => {
				if (!props.disabled) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = "transparent";
			}}
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
				{props.children}
			</svg>
		</button>
	);
}
