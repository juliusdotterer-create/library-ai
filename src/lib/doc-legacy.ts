/**
 * Reader für alte Word-Dateien (.doc, Word 97-2003).
 * Liest den OLE2-Container, die Piece-Table sowie die Formatierungs-Tabellen
 * (CHPX/PAPX) und erzeugt daraus formatiertes HTML.
 * Läuft komplett im Browser, ohne externe Abhängigkeiten.
 */

const HEADER_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

type CfbStream = { name: string; start: number; size: number };

export type LegacyKind = "cfb" | "rtf" | "html" | "zip" | "unknown";

/** Erkennt, was wirklich in der Datei steckt (viele „.doc" sind RTF oder HTML). */
export function sniffLegacyDoc(buffer: ArrayBuffer): LegacyKind {
  const bytes = new Uint8Array(buffer);
  if (HEADER_SIG.every((b, i) => bytes[i] === b)) return "cfb";
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 512)).trim();
  if (head.startsWith("{\\rt")) return "rtf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  if (/^<(!doctype html|html|\?xml|meta)/i.test(head)) return "html";
  return "unknown";
}

/* ------------------------------------------------------------------ CFB */

function readChain(fat: Int32Array, start: number, max: number): number[] {
  const chain: number[] = [];
  let sector = start;
  while (sector >= 0 && sector < fat.length && chain.length < max) {
    chain.push(sector);
    sector = fat[sector];
  }
  return chain;
}

function concatSectors(
  bytes: Uint8Array,
  chain: number[],
  sectorSize: number,
  offsetBase: number,
): Uint8Array {
  const out = new Uint8Array(chain.length * sectorSize);
  chain.forEach((sector, i) => {
    const start = offsetBase + sector * sectorSize;
    out.set(bytes.subarray(start, start + sectorSize), i * sectorSize);
  });
  return out;
}

function openCfb(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (!HEADER_SIG.every((b, i) => view.getUint8(i) === b))
    throw new Error("Kein gültiges Word-97-Dokument");

  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const numFatSectors = view.getUint32(44, true);
  const dirStart = view.getUint32(48, true);
  const miniCutoff = view.getUint32(56, true) || 4096;
  const miniFatStart = view.getUint32(60, true);
  const difatStart = view.getUint32(68, true);
  const numDifat = view.getUint32(72, true);
  const maxSectors = Math.ceil(bytes.length / sectorSize) + 1;

  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFatSectors; i++) {
    const s = view.getUint32(76 + i * 4, true);
    if (s < 0xfffffffc) fatSectors.push(s);
  }
  let difSector = difatStart;
  for (let i = 0; i < numDifat && difSector < 0xfffffffc; i++) {
    const base = 512 + difSector * sectorSize;
    const perSector = sectorSize / 4 - 1;
    for (let j = 0; j < perSector; j++) {
      const s = view.getUint32(base + j * 4, true);
      if (s < 0xfffffffc) fatSectors.push(s);
    }
    difSector = view.getUint32(base + perSector * 4, true);
  }

  const fat = new Int32Array(fatSectors.length * (sectorSize / 4));
  fatSectors.forEach((sector, i) => {
    const base = 512 + sector * sectorSize;
    for (let j = 0; j < sectorSize / 4; j++) {
      const value = view.getUint32(base + j * 4, true);
      fat[i * (sectorSize / 4) + j] = value >= 0xfffffffc ? -1 : value;
    }
  });

  const dirBytes = concatSectors(bytes, readChain(fat, dirStart, maxSectors), sectorSize, 512);
  const dirView = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
  const streams: CfbStream[] = [];
  let rootStart = 0;
  let rootSize = 0;
  for (let i = 0; (i + 1) * 128 <= dirBytes.length; i++) {
    const off = i * 128;
    const nameLen = dirView.getUint16(off + 64, true);
    if (nameLen < 2) continue;
    let name = "";
    for (let c = 0; c < nameLen / 2 - 1; c++)
      name += String.fromCharCode(dirView.getUint16(off + c * 2, true));
    const type = dirView.getUint8(off + 66);
    const start = dirView.getUint32(off + 116, true);
    const size = dirView.getUint32(off + 120, true);
    if (type === 5) {
      rootStart = start;
      rootSize = size;
    } else if (type === 2) {
      streams.push({ name, start, size });
    }
  }

  const miniStream = rootSize
    ? concatSectors(bytes, readChain(fat, rootStart, maxSectors), sectorSize, 512)
    : new Uint8Array(0);
  const miniFatBytes = concatSectors(
    bytes,
    miniFatStart < 0xfffffffc ? readChain(fat, miniFatStart, maxSectors) : [],
    sectorSize,
    512,
  );
  const miniFat = new Int32Array(miniFatBytes.length / 4);
  const miniFatView = new DataView(
    miniFatBytes.buffer,
    miniFatBytes.byteOffset,
    miniFatBytes.byteLength,
  );
  for (let i = 0; i < miniFat.length; i++) {
    const value = miniFatView.getUint32(i * 4, true);
    miniFat[i] = value >= 0xfffffffc ? -1 : value;
  }

  const readStream = (stream: CfbStream): Uint8Array => {
    if (stream.size < miniCutoff && miniStream.length) {
      const chain = readChain(miniFat, stream.start, maxSectors * 8);
      const out = new Uint8Array(chain.length * miniSectorSize);
      chain.forEach((sector, i) => {
        const s = sector * miniSectorSize;
        out.set(miniStream.subarray(s, s + miniSectorSize), i * miniSectorSize);
      });
      return out.subarray(0, stream.size);
    }
    const data = concatSectors(bytes, readChain(fat, stream.start, maxSectors), sectorSize, 512);
    return data.subarray(0, stream.size);
  };

  return { streams, readStream };
}

/* -------------------------------------------------------------- Sprm/FKP */

type CharProps = { b?: boolean; i?: boolean; u?: boolean };
type ParaProps = { istd?: number; jc?: number; ilfo?: number; ilvl?: number; inTable?: boolean; ttp?: boolean };

function sprmLength(opcode: number, data: DataView, pos: number): number {
  const spra = opcode >> 13;
  switch (spra) {
    case 0:
    case 1:
      return 1;
    case 2:
    case 4:
    case 5:
      return 2;
    case 3:
      return 4;
    case 7:
      return 3;
    default: {
      const first = pos < data.byteLength ? data.getUint8(pos) : 0;
      return first === 255 ? 1 : first + 1;
    }
  }
}

function toggle(value: number, current: boolean | undefined): boolean {
  if (value === 0) return false;
  if (value === 1) return true;
  return !current; // 128/129: Stilwert übernehmen -> als "an" behandeln
}

function parseChpxSprms(grpprl: Uint8Array): CharProps {
  const props: CharProps = {};
  const view = new DataView(grpprl.buffer, grpprl.byteOffset, grpprl.byteLength);
  let pos = 0;
  while (pos + 2 <= grpprl.length) {
    const opcode = view.getUint16(pos, true);
    pos += 2;
    const len = sprmLength(opcode, view, pos);
    if (pos + len > grpprl.length) break;
    const val = len >= 1 ? view.getUint8(pos) : 0;
    if (opcode === 0x0835) props.b = toggle(val, props.b);
    else if (opcode === 0x0836) props.i = toggle(val, props.i);
    else if (opcode === 0x2a3e) props.u = val !== 0;
    pos += len;
  }
  return props;
}

function parsePapxSprms(grpprl: Uint8Array, istd: number): ParaProps {
  const props: ParaProps = { istd };
  const view = new DataView(grpprl.buffer, grpprl.byteOffset, grpprl.byteLength);
  let pos = 0;
  while (pos + 2 <= grpprl.length) {
    const opcode = view.getUint16(pos, true);
    pos += 2;
    const len = sprmLength(opcode, view, pos);
    if (pos + len > grpprl.length) break;
    const val = len >= 1 ? view.getUint8(pos) : 0;
    if (opcode === 0x2403) props.jc = val;
    else if (opcode === 0x260a) props.ilvl = val;
    else if (opcode === 0x460b) props.ilfo = view.getUint16(pos, true);
    else if (opcode === 0x2416) props.inTable = val !== 0;
    else if (opcode === 0x2417) props.ttp = val !== 0;
    else if (opcode === 0x4600) props.istd = view.getUint16(pos, true);
    pos += len;
  }
  return props;
}

type Interval<T> = { start: number; end: number; props: T };

/** Liest eine Bin-Table (PlcBte) und alle zugehörigen FKP-Seiten. */
function readFkps<T>(
  table: DataView,
  doc: Uint8Array,
  fc: number,
  lcb: number,
  parse: (page: Uint8Array, pageView: DataView) => Interval<T>[],
): Interval<T>[] {
  if (!lcb || fc + lcb > table.byteLength) return [];
  const n = Math.floor((lcb - 4) / 8);
  const pnBase = fc + (n + 1) * 4;
  const out: Interval<T>[] = [];
  for (let i = 0; i < n; i++) {
    const pn = table.getUint32(pnBase + i * 4, true);
    const start = pn * 512;
    if (start + 512 > doc.length) continue;
    const page = doc.subarray(start, start + 512);
    const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
    try {
      out.push(...parse(page, pageView));
    } catch {
      /* defekte Seite überspringen */
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function parseChpxFkp(page: Uint8Array, view: DataView): Interval<CharProps>[] {
  const crun = view.getUint8(511);
  const res: Interval<CharProps>[] = [];
  for (let i = 0; i < crun; i++) {
    const start = view.getUint32(i * 4, true);
    const end = view.getUint32((i + 1) * 4, true);
    const word = view.getUint8(4 * (crun + 1) + i);
    let props: CharProps = {};
    if (word) {
      const off = word * 2;
      const cb = view.getUint8(off);
      props = parseChpxSprms(page.subarray(off + 1, off + 1 + cb));
    }
    res.push({ start, end, props });
  }
  return res;
}

function parsePapxFkp(page: Uint8Array, view: DataView): Interval<ParaProps>[] {
  const cpara = view.getUint8(511);
  const res: Interval<ParaProps>[] = [];
  for (let i = 0; i < cpara; i++) {
    const start = view.getUint32(i * 4, true);
    const end = view.getUint32((i + 1) * 4, true);
    const word = view.getUint8(4 * (cpara + 1) + i * 13);
    let props: ParaProps = {};
    if (word) {
      const off = word * 2;
      let cb = view.getUint8(off);
      let grpStart = off + 1;
      if (cb === 0) {
        cb = view.getUint8(off + 1);
        grpStart = off + 2;
      }
      const grpLen = Math.max(0, cb * 2 - 1);
      if (grpStart + 2 <= page.length) {
        const istd = view.getUint16(grpStart, true);
        props = parsePapxSprms(page.subarray(grpStart + 2, grpStart + 2 + grpLen), istd);
      }
    }
    res.push({ start, end, props });
  }
  return res;
}

function lookup<T>(list: Interval<T>[], fc: number): T | null {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const item = list[mid];
    if (fc < item.start) hi = mid - 1;
    else if (fc >= item.end) lo = mid + 1;
    else return item.props;
  }
  return null;
}

/* ------------------------------------------------------------- Textabruf */

const CP1252 = (() => {
  const raw = new Uint8Array(256);
  for (let i = 0; i < 256; i++) raw[i] = i;
  return new TextDecoder("windows-1252").decode(raw);
})();

type Doc97 = {
  chars: string[];
  fcs: number[];
  chpx: Interval<CharProps>[];
  papx: Interval<ParaProps>[];
};

function readDoc97(buffer: ArrayBuffer): Doc97 {
  const { streams, readStream } = openCfb(buffer);

  const wordStream = streams.find((s) => s.name === "WordDocument");
  if (!wordStream) throw new Error("WordDocument-Stream fehlt");
  const doc = readStream(wordStream);
  const docView = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);

  const flags = docView.getUint16(0x000a, true);
  if (flags & 0x0100) throw new Error("Das Dokument ist verschlüsselt.");
  const tableName = flags & 0x0200 ? "1Table" : "0Table";
  const tableStream =
    streams.find((s) => s.name === tableName) ?? streams.find((s) => /Table$/.test(s.name));
  if (!tableStream) throw new Error("Table-Stream fehlt");
  const table = readStream(tableStream);
  const tableView = new DataView(table.buffer, table.byteOffset, table.byteLength);

  const ccpText = docView.getUint32(0x004c, true);
  const fcClx = docView.getUint32(0x01a2, true);
  const lcbClx = docView.getUint32(0x01a6, true);
  if (!lcbClx || fcClx + lcbClx > table.length) throw new Error("Piece-Table nicht lesbar");

  let pos = fcClx;
  const end = fcClx + lcbClx;
  let pieceTable: { offset: number; length: number } | null = null;
  while (pos < end) {
    const clxt = tableView.getUint8(pos);
    if (clxt === 1) {
      const cb = tableView.getUint16(pos + 1, true);
      pos += 3 + cb;
    } else if (clxt === 2) {
      const lcb = tableView.getUint32(pos + 1, true);
      pieceTable = { offset: pos + 5, length: lcb };
      break;
    } else break;
  }
  if (!pieceTable) throw new Error("Keine Piece-Table gefunden");

  const pieceCount = Math.floor((pieceTable.length - 4) / 12);
  const cpBase = pieceTable.offset;
  const pcdBase = cpBase + (pieceCount + 1) * 4;

  const chars: string[] = [];
  const fcs: number[] = [];
  const limit = ccpText || Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < pieceCount && chars.length < limit; i++) {
    const cpStart = tableView.getUint32(cpBase + i * 4, true);
    const cpEnd = tableView.getUint32(cpBase + (i + 1) * 4, true);
    const fcRaw = tableView.getUint32(pcdBase + i * 8 + 2, true);
    const compressed = (fcRaw & 0x40000000) !== 0;
    const fc = compressed ? (fcRaw & 0x3fffffff) / 2 : fcRaw & 0x3fffffff;
    const count = Math.min(cpEnd - cpStart, limit - chars.length);
    for (let c = 0; c < count; c++) {
      if (compressed) {
        const byte = doc[fc + c];
        if (byte === undefined) break;
        chars.push(CP1252[byte]);
        fcs.push(fc + c);
      } else {
        const off = fc + c * 2;
        if (off + 1 >= doc.length) break;
        chars.push(String.fromCharCode(doc[off] | (doc[off + 1] << 8)));
        fcs.push(off);
      }
    }
  }

  let chpx: Interval<CharProps>[] = [];
  let papx: Interval<ParaProps>[] = [];
  try {
    chpx = readFkps(
      tableView,
      doc,
      docView.getUint32(0x00fa, true),
      docView.getUint32(0x00fe, true),
      parseChpxFkp,
    );
    papx = readFkps(
      tableView,
      doc,
      docView.getUint32(0x0102, true),
      docView.getUint32(0x0106, true),
      parsePapxFkp,
    );
  } catch {
    /* ohne Formatierung weitermachen */
  }

  return { chars, fcs, chpx, papx };
}

/* ------------------------------------------------------------------ HTML */

function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

type Run = { text: string; props: CharProps };
type Para = { runs: Run[]; props: ParaProps; endsCell: boolean };

function sameProps(a: CharProps, b: CharProps) {
  return !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u;
}

function buildParagraphs(doc: Doc97): Para[] {
  const paras: Para[] = [];
  let runs: Run[] = [];
  let current: Run | null = null;
  let endsCell = false;
  let skipField = false;

  const pushChar = (ch: string, props: CharProps) => {
    if (current && sameProps(current.props, props)) current.text += ch;
    else {
      current = { text: ch, props };
      runs.push(current);
    }
  };

  const flush = (fc: number) => {
    const props = lookup(doc.papx, fc) ?? {};
    paras.push({ runs, props, endsCell });
    runs = [];
    current = null;
    endsCell = false;
  };

  for (let i = 0; i < doc.chars.length; i++) {
    const ch = doc.chars[i];
    const code = ch.charCodeAt(0);
    const fc = doc.fcs[i];

    if (code === 0x13) {
      skipField = true;
      continue;
    }
    if (code === 0x14) {
      skipField = false;
      continue;
    }
    if (code === 0x15) {
      skipField = false;
      continue;
    }
    if (skipField) continue;

    if (code === 0x0d || code === 0x0c) {
      flush(fc);
      continue;
    }
    if (code === 0x07) {
      endsCell = true;
      flush(fc);
      continue;
    }
    if (code === 0x0b) {
      pushChar("\n", lookup(doc.chpx, fc) ?? {});
      continue;
    }
    if (code === 0x01 || code === 0x08) {
      pushChar("[Bild]", {}); // Platzhalter für Bild
      continue;
    }
    if (code === 0x02 || code === 0x05 || code === 0x1f) continue;
    if (code === 0x1e) {
      pushChar("\u2011", lookup(doc.chpx, fc) ?? {});
      continue;
    }
    if (code < 0x20 && code !== 0x09) continue;

    pushChar(ch, lookup(doc.chpx, fc) ?? {});
  }
  if (runs.length) flush(doc.fcs[doc.fcs.length - 1] ?? 0);

  return paras;
}

function runsToHtml(runs: Run[]): string {
  return runs
    .map((run) => {
      const text = escapeHtml(run.text).replace(/\n/g, "<br />");
      if (!text) return "";
      let html = text;
      if (run.props.b) html = `<strong>${html}</strong>`;
      if (run.props.i) html = `<em>${html}</em>`;
      if (run.props.u) html = `<u>${html}</u>`;
      return html;
    })
    .join("");
}

const ALIGN = ["", "text-align:center", "text-align:right", "text-align:justify"];

function paraText(para: Para) {
  return para.runs.map((r) => r.text).join("");
}

function paraHtml(para: Para): string {
  const inner = runsToHtml(para.runs);
  if (!inner.trim()) return "";
  const istd = para.props.istd ?? 0;
  const style = ALIGN[para.props.jc ?? 0] ? ` style="${ALIGN[para.props.jc ?? 0]}"` : "";
  if (istd >= 1 && istd <= 9) {
    const level = Math.min(istd, 4);
    return `<h${level}${style}>${inner}</h${level}>`;
  }
  return `<p${style}>${inner}</p>`;
}

const BULLET_RE = /^\s*([•▪◦o\u00b7\u2022\u25aa-]|[0-9]+[.)]|[a-zA-Z][.)])\s+/;

function stripBullet(para: Para) {
  const clone: Para = { ...para, runs: para.runs.map((r) => ({ ...r })) };
  const first = clone.runs[0];
  if (first) first.text = first.text.replace(BULLET_RE, "");
  return clone;
}

function renderBody(paras: Para[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < paras.length) {
    const para = paras[i];

    // Tabelle
    if (para.props.inTable || para.endsCell) {
      const rows: string[][] = [];
      let cells: string[] = [];
      while (i < paras.length && (paras[i].props.inTable || paras[i].endsCell)) {
        const p = paras[i];
        if (p.props.ttp || (p.endsCell && !paraText(p).trim() && cells.length)) {
          if (paraText(p).trim()) cells.push(paraHtml(p));
          rows.push(cells);
          cells = [];
        } else if (p.endsCell) {
          cells.push(paraHtml(p));
        } else {
          cells.push(paraHtml(p));
        }
        i++;
      }
      if (cells.length) rows.push(cells);
      const body = rows
        .filter((r) => r.length)
        .map((r) => `<tr>${r.map((c) => `<td>${c || "&nbsp;"}</td>`).join("")}</tr>`)
        .join("");
      if (body) out.push(`<table><tbody>${body}</tbody></table>`);
      continue;
    }

    // Liste
    const isList = (p: Para) => (p.props.ilfo ?? 0) > 0 || BULLET_RE.test(paraText(p));
    if (isList(para) && paraText(para).trim()) {
      const ordered = /^\s*([0-9]+|[a-zA-Z])[.)]\s/.test(paraText(para));
      const items: string[] = [];
      while (i < paras.length && isList(paras[i]) && paraText(paras[i]).trim()) {
        const inner = runsToHtml(stripBullet(paras[i]).runs);
        if (inner.trim()) items.push(`<li>${inner}</li>`);
        i++;
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    const html = paraHtml(para);
    if (html) out.push(html);
    i++;
  }

  return out.join("");
}

/* ------------------------------------------------------------------- RTF */

function rtfToHtml(buffer: ArrayBuffer): string {
  const src = new TextDecoder("latin1").decode(new Uint8Array(buffer));
  let out = "";
  let depth = 0;
  const skipGroups: number[] = [];
  let bold = false;
  let italic = false;
  const paras: string[] = [];
  let line = "";
  let pending = "";
  let pendingB = false;
  let pendingI = false;

  /** Sammelt gleich formatierte Zeichen zu einem Run zusammen. */
  const flushRun = () => {
    if (!pending) return;
    let html = pending;
    if (pendingB) html = `<strong>${html}</strong>`;
    if (pendingI) html = `<em>${html}</em>`;
    line += html;
    pending = "";
  };

  const append = (text: string) => {
    if (pending && (pendingB !== bold || pendingI !== italic)) flushRun();
    pendingB = bold;
    pendingI = italic;
    pending += text;
  };

  const endPara = () => {
    flushRun();
    if (line.trim()) paras.push(`<p>${line}</p>`);
    line = "";
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      if (skipGroups.length && skipGroups[skipGroups.length - 1] === depth) skipGroups.pop();
      depth--;
      continue;
    }
    if (ch === "\\") {
      const rest = src.slice(i + 1);
      const hex = /^'([0-9a-fA-F]{2})/.exec(rest);
      if (hex) {
        if (!skipGroups.length) {
          const bytes = new Uint8Array([parseInt(hex[1], 16)]);
          append(escapeHtml(new TextDecoder("windows-1252").decode(bytes)));
        }
        i += 3;
        continue;
      }
      const word = /^([a-zA-Z]+)(-?\d+)?[ ]?/.exec(rest);
      if (!word) {
        if (!skipGroups.length) append(escapeHtml(rest[0] ?? ""));
        i += 1;
        continue;
      }
      const [full, name, numRaw] = word;
      const num = numRaw ? parseInt(numRaw, 10) : undefined;
      i += full.length;
      if (["fonttbl", "colortbl", "stylesheet", "info", "pict", "generator", "themedata", "datastore"].includes(name)) {
        skipGroups.push(depth);
        continue;
      }
      if (skipGroups.length) continue;
      if (name === "par" || name === "pard" || name === "sect") {
        if (name !== "pard") endPara();
        continue;
      }
      if (name === "line") {
        flushRun();
        line += "<br />";
      }
      else if (name === "b") bold = num !== 0;
      else if (name === "i") italic = num !== 0;
      else if (name === "tab") append("&nbsp;&nbsp;&nbsp;&nbsp;");
      else if (name === "u" && num !== undefined) {
        append(escapeHtml(String.fromCharCode(num < 0 ? num + 65536 : num)));
      }
      continue;
    }
    if (ch === "\r" || ch === "\n") continue;
    if (skipGroups.length) continue;
    append(escapeHtml(ch));
  }
  endPara();
  out = paras.join("");
  return out || "<p><em>Dieses Dokument enthält keinen lesbaren Text.</em></p>";
}

/* ---------------------------------------------------------------- Public */

/** Erzeugt formatiertes HTML aus einem .doc-ArrayBuffer. */
export function extractLegacyDocHtml(buffer: ArrayBuffer): string {
  const kind = sniffLegacyDoc(buffer);
  if (kind === "zip") throw new Error("DOCX");
  if (kind === "rtf") return rtfToHtml(buffer);
  if (kind === "html") {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/?(html|head|body|meta|link)[^>]*>/gi, "");
  }
  const doc = readDoc97(buffer);
  const html = renderBody(buildParagraphs(doc));
  return html || "<p><em>Dieses Dokument enthält keinen lesbaren Text.</em></p>";
}
