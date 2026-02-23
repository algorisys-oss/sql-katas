import { Elysia } from "elysia";
import type { Kata } from "../lib/kata-loader";

interface KataSummary {
	id: string;
	sequence: number;
	title: string;
}

interface PhaseGroup {
	phase: number;
	title: string;
	katas: KataSummary[];
}

export function kataRoutes(katas: Kata[]) {
	const kataMap = new Map<string, Kata>();
	for (const k of katas) {
		kataMap.set(k.id, k);
	}

	const phases: PhaseGroup[] = [];
	const phaseMap = new Map<number, PhaseGroup>();

	for (const k of katas) {
		let group = phaseMap.get(k.phase);
		if (!group) {
			group = { phase: k.phase, title: k.phaseTitle, katas: [] };
			phaseMap.set(k.phase, group);
			phases.push(group);
		}
		group.katas.push({ id: k.id, sequence: k.sequence, title: k.title });
	}

	phases.sort((a, b) => a.phase - b.phase);
	for (const p of phases) {
		p.katas.sort((a, b) => a.sequence - b.sequence);
	}

	return new Elysia({ prefix: "/api" })
		.get("/katas", () => ({ phases }))
		.get("/katas/:id", ({ params, set }) => {
			const kata = kataMap.get(params.id);
			if (!kata) {
				set.status = 404;
				return { error: "Kata not found" };
			}
			return kata;
		});
}
