export default function NotFound() {
	return (
		<div
			class="min-h-screen flex flex-col items-center justify-center"
			style={{ "background-color": "var(--bg-primary)" }}
		>
			<span class="text-5xl mb-4">🔍</span>
			<h1
				class="text-2xl font-bold mb-2"
				style={{ color: "var(--text-primary)" }}
			>
				404
			</h1>
			<p style={{ color: "var(--text-secondary)" }}>Page not found.</p>
			<a
				href="/"
				class="mt-6 text-sm font-medium px-4 py-2 rounded-md transition-colors"
				style={{
					color: "var(--accent)",
					"background-color": "var(--accent-light)",
				}}
			>
				Back to Home
			</a>
		</div>
	);
}
