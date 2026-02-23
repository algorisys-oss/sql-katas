import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./app";
import Landing from "./pages/landing";
import QueryLab from "./pages/query-lab";
import KatasBrowser from "./pages/katas-browser";
import KataPage from "./pages/kata-page";
import NotFound from "./pages/not-found";
import "./global.css";

function KatasWelcome() {
	return (
		<div class="flex flex-1 flex-col items-center justify-center p-12 text-center">
			<h2
				class="text-xl font-semibold mb-3"
				style={{ color: "var(--text-primary)" }}
			>
				Welcome to SQL Katas
			</h2>
			<p class="max-w-md" style={{ color: "var(--text-secondary)" }}>
				Select a kata from the sidebar to begin. Start with Phase 0 to build a
				solid foundation in relational thinking.
			</p>
		</div>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

render(
	() => (
		<Router root={App}>
			<Route path="/" component={Landing} />
			<Route path="/lab" component={QueryLab} />
			<Route path="/katas" component={KatasBrowser}>
				<Route path="/" component={KatasWelcome} />
				<Route path="/:phaseId/:kataId" component={KataPage} />
			</Route>
			<Route path="*" component={NotFound} />
		</Router>
	),
	root,
);
