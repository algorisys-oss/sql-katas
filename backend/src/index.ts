import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { queryRoutes } from "./routes/query";

const app = new Elysia()
	.use(cors())
	.use(healthRoutes)
	.use(queryRoutes)
	.listen(8080);

console.log(`SQL Katas backend running at http://localhost:${app.server?.port}`);
