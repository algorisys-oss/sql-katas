import postgres from "postgres";

const DATABASE_URL =
	process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/sql_katas";

const LEARNER_DATABASE_URL =
	process.env.LEARNER_DATABASE_URL ||
	`postgres://${process.env.LEARNER_DB_USER || "sql_katas_learner"}:${process.env.LEARNER_DB_PASSWORD || "learner"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "sql_katas"}`;

const sql = postgres(DATABASE_URL);

const learnerSql = postgres(LEARNER_DATABASE_URL, {
	connection: {
		statement_timeout: 5000,
	},
	max: 5,
});

export { sql, learnerSql };
