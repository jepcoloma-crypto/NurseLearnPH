/**
 * Minimal CSV parsing for roster imports.
 * Each row's first cell identifies the student (email or username); remaining
 * columns are ignored so real-world roster exports still work.
 */

/** Split a single CSV line, honouring double-quoted cells. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/** True when a first cell looks like a header label rather than a value. */
function isHeaderCell(cell: string): boolean {
  return /^(e-?mail|username|student( number|#)?|name|full name)$/i.test(cell);
}

/**
 * Parse pasted/uploaded CSV text into student identifiers.
 * Skips blank lines and a header row when present.
 */
export function parseRosterCsv(text: string): string[] {
  const values: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const first = splitCsvLine(line)[0] ?? "";
    if (!first) continue;
    if (values.length === 0 && isHeaderCell(first)) continue;
    values.push(first);
  }
  // De-duplicate while preserving order
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
