import { Elysia, t } from "elysia";
import { sql, learnerSql } from "../db";
import { validateQuery, wrapWithLimit } from "../lib/sandbox";

const MAX_ROWS = 1000;

export const queryRoutes = new Elysia({ prefix: "/api" })
	.post(
		"/query",
		async ({ body }) => {
			const validation = validateQuery(body.query);
			if (!validation.valid) {
				return { success: false, error: validation.error, rows: [], columns: [] };
			}

			const limited = wrapWithLimit(body.query, MAX_ROWS);

			try {
				const result = await learnerSql.unsafe(limited);
				const columns = result.length > 0 ? Object.keys(result[0]) : [];
				return {
					success: true,
					columns,
					rows: result,
					rowCount: result.length,
					limited: result.length === MAX_ROWS,
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return { success: false, error: message, rows: [], columns: [] };
			}
		},
		{ body: t.Object({ query: t.String() }) },
	)
	.post(
		"/explain",
		async ({ body }) => {
			const validation = validateQuery(body.query);
			if (!validation.valid) {
				return { success: false, error: validation.error, plan: null };
			}

			try {
				const result = await learnerSql.unsafe(`EXPLAIN (FORMAT JSON) ${body.query}`);
				return { success: true, plan: result[0]["QUERY PLAN"] };
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return { success: false, error: message, plan: null };
			}
		},
		{ body: t.Object({ query: t.String() }) },
	)
	.post("/reset", async () => {
		try {
			const seedPath = new URL("../../seeds/001-ecommerce.sql", import.meta.url).pathname;
			const seedSql = await Bun.file(seedPath).text();
			await sql.unsafe(seedSql);
			return { success: true, message: "Dataset reset to initial state." };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		}
	});
