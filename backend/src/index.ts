import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { queryRoutes } from "./routes/query";
import { kataRoutes } from "./routes/katas";
import { loadAllKatas } from "./lib/kata-loader";

const contentDir = new URL("../../katas", import.meta.url).pathname;
const katas = loadAllKatas(contentDir);
console.log(`Loaded ${katas.length} kata(s) from ${contentDir}`);

const app = new Elysia()
	.use(cors())
	.use(healthRoutes)
	.use(queryRoutes)
	.use(kataRoutes(katas))
	.listen(8080);

console.log(`SQL Katas backend running at http://localhost:${app.server?.port}`);
