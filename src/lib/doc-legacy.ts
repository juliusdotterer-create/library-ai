/**
 * Minimaler Reader für alte Word-Dateien (.doc, Word 97-2003).
 * Liest den OLE2-Container und die Piece-Table und liefert den reinen Text.
 * Läuft komplett im Browser, ohne externe Abhängigkeiten.
 */

const HEADER_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

type CfbStream = { name: string; start: number; size: number };

function isCfb(view: DataView): boolean {
  return HEADER_SIG.every((b, i) => view.getUint8(i) === b);
}

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

/** Extrahiert den Text aus einem .doc-ArrayBuffer. Wirft bei unlesbaren Dateien. */
export function extractLegacyDocText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (!isCfb(view)) throw new Error("Kein gültiges Word-97-Dokument");

  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const numFatSectors = view.getUint32(44, true);
  const dirStart = view.getUint32(48, true);
  const miniCutoff = view.getUint32(56, true) || 4096;
  const miniFatStart = view.getUint32(60, true);
  const difatStart = view.getUint32(68, true);
  const numDifat = view.getUint32(72, true);
  const maxSectors = Math.ceil(bytes.length / sectorSize) + 1;

  // DIFAT -> FAT-Sektoren
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

  // FAT aufbauen
  const fat = new Int32Array(fatSectors.length * (sectorSize / 4));
  fatSectors.forEach((sector, i) => {
    const base = 512 + sector * sectorSize;
    for (let j = 0; j < sectorSize / 4; j++) {
      const value = view.getUint32(base + j * 4, true);
      fat[i * (sectorSize / 4) + j] = value >= 0xfffffffc ? -1 : value;
    }
  });

  // Directory lesen
  const dirBytes = concatSectors(bytes, readChain(fat, dirStart, maxSectors), sectorSize, 512);
  const dirView = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
  const streams: CfbStream[] = [];
  let rootStart = 0;
  let rootSize = 0;
  for (let i = 0; i + 128 <= dirBytes.length; i++) {
    const off = i * 128;
    if (off + 128 > dirBytes.length) break;
    const nameLen = dirView.getUint16(off + 64, true);
    if (nameLen < 2) continue;
    let name = "";
    for (let c = 0; c < nameLen / 2 - 1; c++) name += String.fromCharCode(dirView.getUint16(off + c * 2, true));
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

  // Mini-Stream + MiniFAT
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
  const miniFatView = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
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

  const wordStream = streams.find((s) => s.name === "WordDocument");
  if (!wordStream) throw new Error("WordDocument-Stream fehlt");
  const doc = readStream(wordStream);
  const docView = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);

  const flags = docView.getUint16(0x000a, true);
  const tableName = flags & 0x0200 ? "1Table" : "0Table";
  const tableStream = streams.find((s) => s.name === tableName) ?? streams.find((s) => /Table$/.test(s.name));
  if (!tableStream) throw new Error("Table-Stream fehlt");
  const table = readStream(tableStream);
  const tableView = new DataView(table.buffer, table.byteOffset, table.byteLength);

  const fcClx = docView.getUint32(0x01a2, true);
  const lcbClx = docView.getUint32(0x01a6, true);
  if (!lcbClx || fcClx + lcbClx > table.length) throw new Error("Piece-Table nicht lesbar");

  // Clx durchlaufen: Prc-Blöcke (0x01) überspringen, Pcdt (0x02) verwenden
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
  const decoder = new TextDecoder("windows-1252");
  let text = "";

  for (let i = 0; i < pieceCount; i++) {
    const cpStart = tableView.getUint32(cpBase + i * 4, true);
    const cpEnd = tableView.getUint32(cpBase + (i + 1) * 4, true);
    const fcRaw = tableView.getUint32(pcdBase + i * 8 + 2, true);
    const compressed = (fcRaw & 0x40000000) !== 0;
    const fc = compressed ? (fcRaw & 0x3fffffff) / 2 : fcRaw & 0x3fffffff;
    const charCount = cpEnd - cpStart;
    if (compressed) {
      const slice = doc.subarray(fc, fc + charCount);
      text += decoder.decode(slice);
    } else {
      const slice = doc.subarray(fc, fc + charCount * 2);
      let chunk = "";
      for (let c = 0; c + 1 < slice.length; c += 2) chunk += String.fromCharCode(slice[c] | (slice[c + 1] << 8));
      text += chunk;
    }
  }

  return text
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\u0007/g, "\t")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
