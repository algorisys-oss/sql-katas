import type { DiagramStep } from "./sql-step-parser";

interface PlanNode {
	"Node Type": string;
	"Plan Rows"?: number;
	"Actual Rows"?: number;
	"Filter"?: string;
	"Join Type"?: string;
	"Group Key"?: string[];
	Plans?: PlanNode[];
	[key: string]: unknown;
}

/**
 * Walk the EXPLAIN JSON plan tree and enrich DiagramSteps with row counts.
 * Mapping is best-effort and educational — not exact.
 */
export function mapExplainToSteps(
	planJson: unknown,
	steps: DiagramStep[],
): DiagramStep[] {
	if (!planJson || !Array.isArray(planJson) || planJson.length === 0) {
		return steps;
	}

	const root: PlanNode = planJson[0]?.Plan;
	if (!root) return steps;

	// Collect all nodes in the plan tree
	const nodes: PlanNode[] = [];
	function collect(node: PlanNode) {
		nodes.push(node);
		if (node.Plans) {
			for (const child of node.Plans) {
				collect(child);
			}
		}
	}
	collect(root);

	// Find leaf scan nodes (FROM step — initial row source)
	const scanNodes = nodes.filter((n) =>
		["Seq Scan", "Index Scan", "Index Only Scan", "Bitmap Heap Scan"].includes(
			n["Node Type"],
		),
	);

	// Find aggregate nodes (GROUP BY)
	const aggNodes = nodes.filter((n) =>
		["Aggregate", "GroupAggregate", "HashAggregate"].includes(n["Node Type"]),
	);

	// Find sort nodes (ORDER BY)
	const sortNodes = nodes.filter((n) => n["Node Type"] === "Sort");

	// Find limit nodes
	const limitNodes = nodes.filter((n) => n["Node Type"] === "Limit");

	// Find join nodes
	const joinNodes = nodes.filter((n) =>
		["Nested Loop", "Hash Join", "Merge Join"].includes(n["Node Type"]),
	);

	// The root node's output represents the final row count
	const rootRows = root["Actual Rows"] ?? root["Plan Rows"];

	return steps.map((step) => {
		const enriched = { ...step };

		switch (step.type) {
			case "FROM": {
				// Sum of all scan node rows = initial data volume
				if (scanNodes.length > 0) {
					const total = scanNodes.reduce(
						(sum, n) => sum + (n["Actual Rows"] ?? n["Plan Rows"] ?? 0),
						0,
					);
					enriched.estimatedRows = total;
				}
				break;
			}
			case "JOIN": {
				// Use join node output rows
				if (joinNodes.length > 0) {
					const jn = joinNodes.shift();
					if (jn) {
						enriched.estimatedRows = jn["Actual Rows"] ?? jn["Plan Rows"];
					}
				}
				break;
			}
			case "WHERE": {
				// For WHERE, find the node that applies a filter
				// Use the topmost scan/join node with a filter
				const filtered = nodes.find((n) => n.Filter);
				if (filtered) {
					enriched.estimatedRows =
						filtered["Actual Rows"] ?? filtered["Plan Rows"];
				}
				break;
			}
			case "GROUP_BY": {
				if (aggNodes.length > 0) {
					enriched.estimatedRows =
						aggNodes[0]["Actual Rows"] ?? aggNodes[0]["Plan Rows"];
				}
				break;
			}
			case "HAVING": {
				// HAVING filters after aggregation — use aggregate output if available
				if (aggNodes.length > 0) {
					enriched.estimatedRows =
						aggNodes[0]["Actual Rows"] ?? aggNodes[0]["Plan Rows"];
				}
				break;
			}
			case "SELECT": {
				// SELECT doesn't change row count, use root or aggregate output
				if (aggNodes.length > 0) {
					enriched.estimatedRows =
						aggNodes[0]["Actual Rows"] ?? aggNodes[0]["Plan Rows"];
				} else if (rootRows !== undefined) {
					enriched.estimatedRows = rootRows;
				}
				break;
			}
			case "DISTINCT": {
				// Unique node or root output
				const uniqueNode = nodes.find(
					(n) => n["Node Type"] === "Unique" || n["Node Type"] === "HashSetOp",
				);
				if (uniqueNode) {
					enriched.estimatedRows =
						uniqueNode["Actual Rows"] ?? uniqueNode["Plan Rows"];
				} else if (rootRows !== undefined) {
					enriched.estimatedRows = rootRows;
				}
				break;
			}
			case "ORDER_BY": {
				if (sortNodes.length > 0) {
					enriched.estimatedRows =
						sortNodes[0]["Actual Rows"] ?? sortNodes[0]["Plan Rows"];
				} else if (rootRows !== undefined) {
					enriched.estimatedRows = rootRows;
				}
				break;
			}
			case "LIMIT": {
				if (limitNodes.length > 0) {
					enriched.estimatedRows =
						limitNodes[0]["Actual Rows"] ?? limitNodes[0]["Plan Rows"];
				} else if (rootRows !== undefined) {
					enriched.estimatedRows = rootRows;
				}
				break;
			}
		}

		return enriched;
	});
}
