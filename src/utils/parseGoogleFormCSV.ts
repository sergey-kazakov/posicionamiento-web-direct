// src/utils/parseGoogleFormCSV.ts

type Project = any;

const normalize = (s: string) => s.trim().toLowerCase();

function isIgnoredHeader(h: string) {
  const t = normalize(h);

  // Google Forms "Timestamp" localized
  const ignored = new Set([
	"timestamp",
	"marca de tiempo",
	"marcador de tiempo",
	"fecha y hora",
	"time stamp",
	"отметка времени",
	"дата и время",
	"дата/время",
  ]);

  return !t || ignored.has(t);
}

function detectDelimiter(line: string) {
  const cands = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of cands) {
	const c = line.split(d).length;
	if (c > bestCount) {
	  best = d;
	  bestCount = c;
	}
  }
  return best;
}

function splitCSVLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
	const ch = line[i];
	if (ch === '"') {
	  if (inQuotes && line[i + 1] === '"') {
		cur += '"';
		i++;
	  } else {
		inQuotes = !inQuotes;
	  }
	} else if (ch === delim && !inQuotes) {
	  out.push(cur);
	  cur = "";
	} else {
	  cur += ch;
	}
  }
  out.push(cur);
  return out.map(s => s.replace(/^"(.*)"$/, "$1").trim());
}

function isPreferenceLabel(h: string) {
  const t = h
	.toLowerCase()
	.replace(/\(.*?\)/g, "")
	.replace(/\s+/g, " ")
	.trim();

  return (
	t.startsWith("en general") ||
	t.startsWith("overall") ||
	t.includes("preferirías esta marca") ||
	t.includes("prefer this brand")
  );
}

export function parseGoogleFormCSVToResponses(
  text: string,
  project: Project
) {
  const lines = text
	.split(/\r?\n/)
	.map(l => l.trim())
	.filter(l => l.length > 0);

  if (lines.length < 2) {
	throw new Error("CSV vacío o sin respuestas");
  }

  const delim = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delim);

  // --- brand map ---
  const brandMap = new Map<string, string>();
  project.brands.forEach((b: any) => {
	brandMap.set(normalize(b.name), b.name);
  });

  // --- attribute map ---
  const attrMap = new Map<string, string>();
  project.attributes.forEach((a: any) => {
	attrMap.set(normalize(a.id), a.id);
	if (a.labelEs) attrMap.set(normalize(a.labelEs), a.id);
	if (a.labelEn) attrMap.set(normalize(a.labelEn), a.id);
  });

  // --- parse headers ---
  type ColInfo =
	| { kind: "ignore" }
	| { kind: "performance"; brand: string; attrId: string }
	| { kind: "preference"; brand: string };

  const cols: ColInfo[] = headers.map((h) => {
	// ignore timestamp or empty headers
	if (isIgnoredHeader(h)) {
	  return { kind: "ignore" };
	}
  
	// --- preference question ---
	if (isPreferenceLabel(h)) {
	  return { kind: "preference", brand: "__FROM_ROW__" };
	}
  
	// expected format: Brand [Attribute]
	const m = h.match(/^(.+?)\s*\[(.+?)\]\s*$/);
	if (!m) {
	  throw new Error(`Invalid CSV header format: "${h}"`);
	}
  
	const brandRaw = normalize(m[1]);
	const attrRaw = normalize(m[2]);
  
	const brand = brandMap.get(brandRaw);
	if (!brand) {
	  throw new Error(`Unknown brand in CSV header: "${m[1]}"`);
	}
  
	const attrId = attrMap.get(attrRaw);
	if (!attrId) {
	  throw new Error(`Unknown attribute in CSV header: "${m[2]}"`);
	}
  
	return { kind: "performance", brand, attrId };
  });

  // --- parse rows ---
  const responses: any[] = [];

  for (let i = 1; i < lines.length; i++) {
	const cells = splitCSVLine(lines[i], delim);

	const r = {
	  performance: {} as any,
	  preference: {} as any,
	  ts: Date.now(),
	};

	let hasData = false;

	cols.forEach((c, idx) => {
	  if (c.kind === "ignore") return;
	
	  const raw = cells[idx];
	  if (!raw) return;
	
	  const num = Number(raw);
	  if (!Number.isFinite(num)) {
		throw new Error(`Non-numeric value at line ${i + 1}`);
	  }
	
	  const value = Math.min(5, Math.max(1, num));
	
	  if (c.kind === "performance") {
		if (!r.performance[c.brand]) r.performance[c.brand] = {};
		r.performance[c.brand][c.attrId] = value;
		hasData = true;
	  }
	
	  if (c.kind === "preference") {
		const brands = Object.keys(r.performance);
		brands.forEach((b) => {
		  r.preference[b] = value;
		});
		hasData = true;
	  }
	});

	if (hasData) {
	  responses.push(r);
	}
  }

  if (!responses.length) {
	throw new Error("No valid responses found in CSV");
  }

  return responses;
}