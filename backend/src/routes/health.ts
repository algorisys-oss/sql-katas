import { Elysia } from "elysia";
import { sql } from "../db";

export const healthRoutes = new Elysia({ prefix: "/api" }).get("/health", async () => {
	try {
		const result = await sql`SELECT NOW() as time`;
		return { status: "ok", database: "connected", time: result[0].time };
	} catch (error) {
		return { status: "error", database: "disconnected", error: String(error) };
	}
});
