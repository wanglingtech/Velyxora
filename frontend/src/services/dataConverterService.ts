/**
 * Client-Side Data and Format Converters
 * Handles CSV, JSON, Markdown, Color Spaces, and Text Differencing.
 */

// ==================== CSV <-> JSON ====================

export function csvToJson(
  csvText: string,
  delimiter: string = ",",
): { json: any[]; error?: string } {
  try {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length === 0 || !lines[0].trim()) {
      return { json: [] };
    }

    // Auto-detect delimiter if not specified
    let delim = delimiter;
    if (delim === "auto") {
      const firstLine = lines[0];
      const commas = (firstLine.match(/,/g) || []).length;
      const semis = (firstLine.match(/;/g) || []).length;
      const tabs = (firstLine.match(/\t/g) || []).length;
      if (semis > commas && semis > tabs) delim = ";";
      else if (tabs > commas && tabs > semis) delim = "\t";
      else delim = ",";
    }

    // Helper to parse a single CSV line with quote escaping
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === delim && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const jsonList: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const obj: Record<string, any> = {};

      headers.forEach((header, index) => {
        let val: any = values[index] ?? "";
        // Auto convert numbers and booleans
        if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (
          val !== "" &&
          !isNaN(Number(val)) &&
          !val.startsWith("0") &&
          !val.includes("-")
        ) {
          val = Number(val);
        }
        obj[header || `col_${index + 1}`] = val;
      });

      jsonList.push(obj);
    }

    return { json: jsonList };
  } catch (err: any) {
    return { json: [], error: err?.message || "Error al procesar CSV" };
  }
}

export function jsonToCsv(jsonData: any, delimiter: string = ","): string {
  let list: any[] = [];
  if (typeof jsonData === "string") {
    jsonData = JSON.parse(jsonData);
  }

  if (Array.isArray(jsonData)) {
    list = jsonData;
  } else if (typeof jsonData === "object" && jsonData !== null) {
    list = [jsonData];
  } else {
    throw new Error("El JSON debe ser un array de objetos o un objeto.");
  }

  if (list.length === 0) return "";

  // Collect all unique keys
  const keysSet = new Set<string>();
  list.forEach((item) => {
    if (typeof item === "object" && item !== null) {
      Object.keys(item).forEach((k) => keysSet.add(k));
    }
  });

  const headers = Array.from(keysSet);
  const rows: string[] = [];

  // Escape CSV value
  const escapeVal = (v: any) => {
    if (v === null || v === undefined) return "";
    let str = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  rows.push(headers.map(escapeVal).join(delimiter));

  list.forEach((item) => {
    const row = headers.map((k) => escapeVal(item[k]));
    rows.push(row.join(delimiter));
  });

  return rows.join("\n");
}

// ==================== MARKDOWN <-> HTML ====================

export function markdownToHtml(md: string): string {
  const html = md
    // Escaping
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

    // Headers
    .replace(
      /^### (.*$)/gim,
      '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>',
    )
    .replace(
      /^## (.*$)/gim,
      '<h2 class="text-xl font-bold text-white mt-5 mb-2.5">$1</h2>',
    )
    .replace(
      /^# (.*$)/gim,
      '<h1 class="text-2xl font-black text-white mt-6 mb-3">$1</h1>',
    )

    // Blockquotes (escaping already turned ">" into "&gt;")
    .replace(
      /^&gt; (.*$)/gim,
      '<blockquote class="border-l-4 border-indigo-500 pl-4 py-1 italic text-slate-300 my-2">$1</blockquote>',
    )

    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, "<strong><em>$1</em></strong>")
    .replace(
      /\*\*(.*?)\*\*/gim,
      '<strong class="font-bold text-indigo-300">$1</strong>',
    )
    .replace(/\*(.*?)\*/gim, '<em class="italic text-slate-300">$1</em>')

    // Inline Code
    .replace(
      /`(.*?)`/gim,
      '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-xs">$1</code>',
    )

    // Links
    .replace(/\[(.*?)\]\((.*?)\)/gim, (_match, label, href) => {
      const safe = /^(https?:\/\/|mailto:)/i.test(String(href).trim()) ? String(href).trim() : '#';
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline hover:text-indigo-300">${label}</a>`;
    })

    // Horizontal rules
    .replace(/^---$/gim, '<hr class="border-white/10 my-4" />')

    // Unordered lists
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300">$1</li>')

    // Paragraphs
    .replace(/\n\n/gim, '</p><p class="mb-3 text-slate-300 leading-relaxed">');

  return `<div class="prose prose-invert max-w-none"><p class="mb-3 text-slate-300 leading-relaxed">${html}</p></div>`;
}

export function htmlToMarkdown(html: string): string {
  const md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // remove any remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  return md.trim();
}

// ==================== COLOR CONVERSIONS ====================

export interface ColorDetails {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
}

export function parseColorToAll(input: string): ColorDetails | null {
  const clean = input.trim();

  // Check HEX
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) {
    let hex = clean.replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return rgbToAll(r, g, b);
  }

  // Check RGB
  const rgbMatch = clean.match(/rgba?\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    return rgbToAll(r, g, b);
  }

  return null;
}

export function rgbToAll(r: number, g: number, b: number): ColorDetails {
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

  // RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  // RGB to CMYK
  let c = 0;
  let m = 0;
  let y = 0;
  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k < 1) {
    c = (1 - rNorm - k) / (1 - k);
    m = (1 - gNorm - k) / (1 - k);
    y = (1 - bNorm - k) / (1 - k);
  }

  return {
    hex,
    rgb: { r, g, b },
    hsl: {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    },
    cmyk: {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100),
    },
  };
}

// ==================== TEXT DIFF CHECKER ====================

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  lineNumberA?: number;
  lineNumberB?: number;
}

export function computeTextDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split(/\r?\n/);
  const linesB = textB.split(/\r?\n/);
  const diff: DiffLine[] = [];

  let idxA = 0;
  let idxB = 0;

  while (idxA < linesA.length || idxB < linesB.length) {
    if (
      idxA < linesA.length &&
      idxB < linesB.length &&
      linesA[idxA] === linesB[idxB]
    ) {
      diff.push({
        type: "unchanged",
        text: linesA[idxA],
        lineNumberA: idxA + 1,
        lineNumberB: idxB + 1,
      });
      idxA++;
      idxB++;
    } else {
      // Lookahead check
      const findInB = linesB.indexOf(linesA[idxA], idxB);
      const findInA = linesA.indexOf(linesB[idxB], idxA);

      if (
        idxA < linesA.length &&
        (findInB === -1 || (findInA !== -1 && findInA <= findInB))
      ) {
        diff.push({
          type: "removed",
          text: linesA[idxA],
          lineNumberA: idxA + 1,
        });
        idxA++;
      } else if (idxB < linesB.length) {
        diff.push({
          type: "added",
          text: linesB[idxB],
          lineNumberB: idxB + 1,
        });
        idxB++;
      } else {
        idxA++;
        idxB++;
      }
    }
  }

  return diff;
}
