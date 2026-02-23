import { sql, learnerSql } from "./db";

const seedPath = new URL("../seeds/001-ecommerce.sql", import.meta.url).pathname;
const seedSql = await Bun.file(seedPath).text();

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
	try {
		await sql.unsafe(seedSql);
		console.log("Seed completed successfully.");
		break;
	} catch (error: unknown) {
		const pgError = error as { code?: string };
		if (pgError.code === "57P03" && attempt < MAX_RETRIES) {
			console.log(
				`Database is starting up... retrying in ${RETRY_DELAY_MS / 1000}s (${attempt}/${MAX_RETRIES})`,
			);
			await Bun.sleep(RETRY_DELAY_MS);
			continue;
		}
		console.error("Seed failed:", error);
		await sql.end();
		await learnerSql.end();
		process.exit(1);
	}
}

await sql.end();
await learnerSql.end();
