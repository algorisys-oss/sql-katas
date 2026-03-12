export interface DiagramStep {
	type:
		| "CTE"
		| "FROM"
		| "JOIN"
		| "WHERE"
		| "GROUP_BY"
		| "HAVING"
		| "SELECT"
		| "DISTINCT"
		| "ORDER_BY"
		| "LIMIT";
	label: string;
	description: string;
	estimatedRows?: number;
	actualRows?: number;
}

const STEP_DESCRIPTIONS: Record<DiagramStep["type"], string> = {
	CTE: "Define named subquery (WITH clause)",
	FROM: "Gather source tables",
	JOIN: "Combine with related table",
	WHERE: "Filter individual rows",
	GROUP_BY: "Form groups for aggregation",
	HAVING: "Filter groups after aggregation",
	SELECT: "Evaluate expressions and aliases",
	DISTINCT: "Remove duplicate rows",
	ORDER_BY: "Sort the result set",
	LIMIT: "Restrict output rows",
};

/**
 * Remove string literals, block comments, and line comments
 * to avoid matching keywords inside them.
 */
function stripLiteralsAndComments(sql: string): string {
	return sql
		.replace(/--[^\n]*/g, " ") // line comments
		.replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
		.replace(/'(?:[^'\\]|\\.)*'/g, "'_STR_'") // single-quoted strings
		.replace(/"(?:[^"\\]|\\.)*"/g, '"_ID_"'); // double-quoted identifiers
}

/**
 * Remove content inside balanced parentheses to avoid matching
 * keywords inside subqueries. Replaces with (_SUB_).
 */
function stripParenthesized(sql: string): string {
	let result = "";
	let depth = 0;
	for (const ch of sql) {
		if (ch === "(") {
			if (depth === 0) result += "(_SUB_";
			depth++;
		} else if (ch === ")") {
			depth--;
			if (depth === 0) result += ")";
		} else if (depth === 0) {
			result += ch;
		}
	}
	return result;
}

/**
 * Extract the text of a clause from the original SQL (with comments/strings stripped).
 * Returns a trimmed, single-line summary.
 */
function extractClauseText(
	cleanedSql: string,
	keyword: RegExp,
	nextKeywords: RegExp[],
): string {
	const match = keyword.exec(cleanedSql);
	if (!match) return "";

	const start = match.index;
	let end = cleanedSql.length;

	for (const nk of nextKeywords) {
		const nm = nk.exec(cleanedSql.slice(match.index + match[0].length));
		if (nm) {
			const pos = match.index + match[0].length + nm.index;
			if (pos < end) end = pos;
		}
	}

	const text = cleanedSql
		.slice(start, end)
		.replace(/\s+/g, " ")
		.trim();

	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

const TOP_LEVEL_KEYWORDS = [
	/\bWITH\b/i,
	/\bSELECT\b/i,
	/\bFROM\b/i,
	/\b(INNER\s+JOIN|LEFT\s+(OUTER\s+)?JOIN|RIGHT\s+(OUTER\s+)?JOIN|FULL\s+(OUTER\s+)?JOIN|CROSS\s+JOIN|JOIN)\b/gi,
	/\bWHERE\b/i,
	/\bGROUP\s+BY\b/i,
	/\bHAVING\b/i,
	/\bORDER\s+BY\b/i,
	/\bLIMIT\b/i,
	/\bOFFSET\b/i,
	/\bDISTINCT\b/i,
];

const BOUNDARY_KEYWORDS = [
	/\bSELECT\b/i,
	/\bFROM\b/i,
	/\b(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|FULL\s+(?:OUTER\s+)?|CROSS\s+)?JOIN\b/i,
	/\bWHERE\b/i,
	/\bGROUP\s+BY\b/i,
	/\bHAVING\b/i,
	/\bORDER\s+BY\b/i,
	/\bLIMIT\b/i,
	/\bOFFSET\b/i,
];

export function parseLogicalSteps(sql: string): DiagramStep[] {
	const cleaned = stripLiteralsAndComments(sql);
	const topLevel = stripParenthesized(cleaned);
	const upper = topLevel.toUpperCase();

	const steps: DiagramStep[] = [];

	// CTE
	if (/\bWITH\b/i.test(topLevel)) {
		const cteNames = [...topLevel.matchAll(/\bWITH\b\s+(\w+)|,\s*(\w+)\s+AS/gi)];
		const names = cteNames
			.map((m) => m[1] || m[2])
			.filter(Boolean)
			.join(", ");
		steps.push({
			type: "CTE",
			label: `WITH ${names || "..."}`,
			description: STEP_DESCRIPTIONS.CTE,
		});
	}

	// FROM (execution order step 1)
	if (/\bFROM\b/i.test(topLevel)) {
		const label = extractClauseText(cleaned, /\bFROM\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "FROM",
			label: label || "FROM ...",
			description: STEP_DESCRIPTIONS.FROM,
		});
	}

	// JOINs
	const joinRe =
		/\b(INNER\s+JOIN|LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|FULL\s+(?:OUTER\s+)?JOIN|CROSS\s+JOIN|JOIN)\b/gi;
	let joinMatch: RegExpExecArray | null;
	while ((joinMatch = joinRe.exec(topLevel)) !== null) {
		// Extract join target (table name after JOIN keyword)
		const afterJoin = topLevel.slice(joinMatch.index).replace(/\s+/g, " ").trim();
		const joinLabel =
			afterJoin.length > 80 ? `${afterJoin.slice(0, 77)}...` : afterJoin;
		// Trim to the ON/USING clause end or next keyword
		const shortLabel = joinLabel.replace(/\s+(WHERE|GROUP|HAVING|ORDER|LIMIT)\b.*/i, "");
		steps.push({
			type: "JOIN",
			label: shortLabel.length > 80 ? `${shortLabel.slice(0, 77)}...` : shortLabel,
			description: STEP_DESCRIPTIONS.JOIN,
		});
	}

	// WHERE (execution order step 2)
	if (/\bWHERE\b/i.test(topLevel)) {
		const label = extractClauseText(cleaned, /\bWHERE\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "WHERE",
			label: label || "WHERE ...",
			description: STEP_DESCRIPTIONS.WHERE,
		});
	}

	// GROUP BY (step 3)
	if (/\bGROUP\s+BY\b/i.test(topLevel)) {
		const label = extractClauseText(cleaned, /\bGROUP\s+BY\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "GROUP_BY",
			label: label || "GROUP BY ...",
			description: STEP_DESCRIPTIONS.GROUP_BY,
		});
	}

	// HAVING (step 4)
	if (/\bHAVING\b/i.test(topLevel)) {
		const label = extractClauseText(cleaned, /\bHAVING\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "HAVING",
			label: label || "HAVING ...",
			description: STEP_DESCRIPTIONS.HAVING,
		});
	}

	// SELECT (step 5)
	{
		const label = extractClauseText(cleaned, /\bSELECT\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "SELECT",
			label: label || "SELECT ...",
			description: STEP_DESCRIPTIONS.SELECT,
		});
	}

	// DISTINCT (step 6)
	if (/\bSELECT\s+DISTINCT\b/i.test(upper)) {
		steps.push({
			type: "DISTINCT",
			label: "DISTINCT",
			description: STEP_DESCRIPTIONS.DISTINCT,
		});
	}

	// ORDER BY (step 7)
	if (/\bORDER\s+BY\b/i.test(topLevel)) {
		const label = extractClauseText(cleaned, /\bORDER\s+BY\b/i, BOUNDARY_KEYWORDS);
		steps.push({
			type: "ORDER_BY",
			label: label || "ORDER BY ...",
			description: STEP_DESCRIPTIONS.ORDER_BY,
		});
	}

	// LIMIT / OFFSET (step 8)
	if (/\bLIMIT\b/i.test(topLevel) || /\bOFFSET\b/i.test(topLevel)) {
		const limitLabel = extractClauseText(cleaned, /\bLIMIT\b/i, [/\bOFFSET\b/i]);
		const offsetLabel = extractClauseText(cleaned, /\bOFFSET\b/i, []);
		const combined = [limitLabel, offsetLabel].filter(Boolean).join(" ");
		steps.push({
			type: "LIMIT",
			label: combined || "LIMIT ...",
			description: STEP_DESCRIPTIONS.LIMIT,
		});
	}

	return steps;
}
