const BLOCKED_KEYWORDS = [
	"INSERT",
	"UPDATE",
	"DELETE",
	"DROP",
	"ALTER",
	"CREATE",
	"TRUNCATE",
	"GRANT",
	"REVOKE",
	"COPY",
	"EXECUTE",
	"CALL",
	"SET",
	"RESET",
	"BEGIN",
	"COMMIT",
	"ROLLBACK",
];

export function validateQuery(query: string): { valid: boolean; error?: string } {
	const trimmed = query.trim();
	if (!trimmed) {
		return { valid: false, error: "Query cannot be empty." };
	}

	const normalized = trimmed.toUpperCase();

	if (
		!normalized.startsWith("SELECT") &&
		!normalized.startsWith("WITH") &&
		!normalized.startsWith("EXPLAIN")
	) {
		return {
			valid: false,
			error: "Only SELECT queries are allowed. Your query must start with SELECT or WITH.",
		};
	}

	for (const keyword of BLOCKED_KEYWORDS) {
		const regex = new RegExp(`\\b${keyword}\\b`, "i");
		if (regex.test(query)) {
			return {
				valid: false,
				error: `The keyword "${keyword}" is not allowed in learner queries. Only SELECT queries are permitted.`,
			};
		}
	}

	const statements = query.split(";").filter((s) => s.trim().length > 0);
	if (statements.length > 1) {
		return { valid: false, error: "Only a single SQL statement is allowed per execution." };
	}

	return { valid: true };
}

export function wrapWithLimit(query: string, maxRows: number): string {
	const normalized = query.trim().toUpperCase();
	if (normalized.includes("LIMIT")) {
		return query;
	}
	const cleaned = query.replace(/;\s*$/, "");
	return `${cleaned} LIMIT ${maxRows}`;
}
