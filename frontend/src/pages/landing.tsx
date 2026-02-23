import TrackCard from "../components/landing/track-card";
import ThemeToggle from "../components/layout/theme-toggle";

export default function Landing() {
	return (
		<div
			class="min-h-screen flex flex-col items-center justify-center p-8"
			style={{ "background-color": "var(--bg-primary)" }}
		>
			<div class="absolute top-6 right-6">
				<ThemeToggle />
			</div>

			<div class="text-center mb-12 max-w-xl">
				<div class="mb-6">
					<span
						class="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl"
						style={{
							"background-color": "var(--accent-light)",
						}}
					>
						🥋
					</span>
				</div>
				<h1
					class="text-4xl font-bold mb-3 tracking-tight"
					style={{ color: "var(--text-primary)" }}
				>
					SQL Katas
				</h1>
				<p class="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
					A language for reasoning about data, not just querying it.
					<br />
					Learn SQL through deliberate, visual practice.
				</p>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
				<TrackCard
					title="Katas"
					description="A structured learning sequence from relational thinking to advanced analytics. Each kata includes visual reasoning, live SQL editors, and execution plan analysis."
					status="active"
					href="/katas"
					icon="🥋"
				/>
				<TrackCard
					title="Applications"
					description="Real-world analytics and reporting use cases built on SQL. Business dashboards, data pipelines, and production query patterns."
					status="coming-soon"
					icon="🚀"
				/>
			</div>

			<p
				class="mt-12 text-xs"
				style={{ color: "var(--text-muted)" }}
			>
				Phases 0–10 · PostgreSQL · ANSI SQL First
			</p>
		</div>
	);
}
