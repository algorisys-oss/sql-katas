export interface QueryResult {
	success: true;
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	limited: boolean;
}

export interface QueryError {
	success: false;
	error: string;
	rows: [];
	columns: [];
}

export type QueryResponse = QueryResult | QueryError;

export interface ExplainResponse {
	success: boolean;
	plan: unknown;
	error?: string;
}

export interface ResetResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface KataSummary {
	id: string;
	sequence: number;
	title: string;
}

export interface PhaseGroup {
	phase: number;
	title: string;
	katas: KataSummary[];
}

export interface KataListResponse {
	phases: PhaseGroup[];
}

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

export interface QueryDiagramResponse {
	success: boolean;
	error?: string;
	steps: DiagramStep[];
}

export interface Kata {
	id: string;
	phase: number;
	phaseTitle: string;
	sequence: number;
	title: string;
	description: string;
	schemaOverview: string;
	reasoning: string;
	starterSql: string;
	solution: string;
	solutionExplanation: string;
	alternativeSolutions: string;
}
