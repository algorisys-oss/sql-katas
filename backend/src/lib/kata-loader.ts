import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Kata {
	id: string;
	phase: number;
	phaseTitle: string;
	sequence: number;
	title: string;
	description: string;
	schemaOverview: string;
	reasoning: string;
	starterSql: string;
	solution: string;
	solutionExplanation: string;
	alternativeSolutions: string;
}

interface Frontmatter {
	id: string;
	phase: number;
	phase_title: string;
	sequence: number;
	title: string;
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		throw new Error("No frontmatter found");
	}

	const endIdx = trimmed.indexOf("---", 3);
	if (endIdx === -1) {
		throw new Error("Unclosed frontmatter");
	}

	const yamlBlock = trimmed.slice(3, endIdx).trim();
	const body = trimmed.slice(endIdx + 3).trim();

	const fm: Record<string, string> = {};
	for (const line of yamlBlock.split("\n")) {
		const match = line.match(/^(\w+):\s*(.*)$/);
		if (match) {
			fm[match[1]] = match[2].trim();
		}
	}

	return {
		frontmatter: {
			id: fm.id || "",
			phase: Number(fm.phase) || 0,
			phase_title: fm.phase_title || "",
			sequence: Number(fm.sequence) || 0,
			title: fm.title || "",
		},
		body,
	};
}

function parseSections(body: string): Record<string, string> {
	const sections: Record<string, string> = {};
	const lines = body.split("\n");

	let currentSection = "";
	let currentContent: string[] = [];

	for (const line of lines) {
		if (line.startsWith("## ")) {
			if (currentSection) {
				sections[currentSection] = currentContent.join("\n").trim();
			}
			currentSection = line.slice(3).trim();
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}

	if (currentSection) {
		sections[currentSection] = currentContent.join("\n").trim();
	}

	return sections;
}

function extractSqlBlock(section: string): string {
	const lines = section.split("\n");
	const code: string[] = [];
	let inBlock = false;

	for (const line of lines) {
		if (line.startsWith("```sql")) {
			inBlock = true;
			continue;
		}
		if (inBlock && line.startsWith("```")) {
			break;
		}
		if (inBlock) {
			code.push(line);
		}
	}

	return code.join("\n");
}

function removeCodeBlocks(section: string): string {
	return section.replace(/```[\w]*\n[\s\S]*?```/g, "").trim();
}

function parseKataFile(filePath: string): Kata {
	const content = readFileSync(filePath, "utf-8");
	const { frontmatter: fm, body } = parseFrontmatter(content);
	const sections = parseSections(body);

	return {
		id: fm.id,
		phase: fm.phase,
		phaseTitle: fm.phase_title,
		sequence: fm.sequence,
		title: fm.title,
		description: sections.Description || "",
		schemaOverview: sections["Schema Overview"] || "",
		reasoning: sections["Step-by-Step Reasoning"] || "",
		starterSql: extractSqlBlock(sections["Starter SQL"] || ""),
		solution: extractSqlBlock(sections.Solution || ""),
		solutionExplanation: removeCodeBlocks(sections.Solution || ""),
		alternativeSolutions: sections["Alternative Solutions"] || "",
	};
}

export function loadAllKatas(contentDir: string): Kata[] {
	let entries: string[];
	try {
		entries = readdirSync(contentDir);
	} catch {
		console.warn(`Content directory not found: ${contentDir}`);
		return [];
	}

	const phaseDirs = entries
		.filter((e) => e.startsWith("phase-"))
		.sort();

	const katas: Kata[] = [];

	for (const dir of phaseDirs) {
		const dirPath = join(contentDir, dir);
		const files = readdirSync(dirPath)
			.filter((f) => f.endsWith(".md"))
			.sort();

		for (const file of files) {
			try {
				katas.push(parseKataFile(join(dirPath, file)));
			} catch (error) {
				console.error(`Failed to parse ${dir}/${file}:`, error);
			}
		}
	}

	return katas;
}
