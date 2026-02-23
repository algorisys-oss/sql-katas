import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./app";
import Landing from "./pages/landing";
import QueryLab from "./pages/query-lab";
import NotFound from "./pages/not-found";
import "./global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

render(
	() => (
		<Router root={App}>
			<Route path="/" component={Landing} />
			<Route path="/lab" component={QueryLab} />
			<Route path="*" component={NotFound} />
		</Router>
	),
	root,
);
