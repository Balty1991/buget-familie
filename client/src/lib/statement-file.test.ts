import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { htmlTableRows, readStatementFile, xlsxRows } from "./statement-file";

const fixture = (name: string) => { const bytes = readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };

/** O arhivă zip minimală, cu fișierele comprimate ca Excel (deflate). */
function zip(files: Record<string, string>): ArrayBuffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(content));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(content.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, directory, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength);
}

describe("extras Excel (.xlsx)", () => {
  it("citește un fișier scris de un program real: antet mai jos, date, sume, a doua foaie ignorată", async () => {
    const parsed = await readStatementFile(fixture("extras-bt.xlsx"));
    expect(parsed.rows).toEqual([
      { line: 5, date: "2026-09-21", description: "Plata la POS non-BT cu card VISA; LIDL DISCOUNT 0123 BUCURESTI RO", amount: 184.5, kind: "expense" },
      { line: 6, date: "2026-09-22", description: "Plata OP inter - canal electronic; ENEL ENERGIE MUNTENIA SA; factura 123 & co", amount: 212.3, kind: "expense" },
      { line: 7, date: "2026-09-25", description: "Incasare salariu ACME SOFTWARE SRL", amount: 9200, kind: "income" },
    ]);
  });

  it("citește textele comune (sharedStrings), textul formatat și formatele de dată proprii", async () => {
    const buffer = zip({
      "xl/workbook.xml": '<workbook xmlns:r="r"><sheets><sheet name="Tranzactii" sheetId="1" r:id="rId7"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
      "xl/sharedStrings.xml": '<sst><si><t>Data</t></si><si><t>Detalii</t></si><si><t>Suma</t></si><si><r><t>MEGA </t></r><r><rPr><b/></rPr><t>IMAGE &amp; CO</t></r></si></sst>',
      "xl/styles.xml": '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/><numFmt numFmtId="165" formatCode="#,##0.00 &quot;lei&quot;"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>',
      "xl/worksheets/sheet3.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>'
        + '<row r="2"><c r="A2" s="1"><v>46286.75</v></c><c r="B2" t="s"><v>3</v></c><c r="D2" s="2"><v>-45.199999999999996</v></c></row></sheetData></worksheet>',
    });
    expect(await xlsxRows(buffer)).toEqual([["Data", "Detalii", "", "Suma"], ["21.09.2026", "MEGA IMAGE & CO", "", "-45.2"]]);
    const parsed = await readStatementFile(buffer);
    expect(parsed.rows).toEqual([{ line: 2, date: "2026-09-21", description: "MEGA IMAGE & CO", amount: 45.2, kind: "expense" }]);
  });
});

describe("„.xls” care e de fapt HTML și .xls vechi", () => {
  it("citește tabelul cel mai mare din pagină", async () => {
    const html = '<html><body><table><tr><td>Logo</td></tr></table><table><tr><th>Data</th><th>Descriere</th><th>Suma</th></tr>'
      + '<tr><td>21.09.2026</td><td>KAUFLAND&nbsp;5920 <br>CLUJ</td><td>-312,40</td></tr><tr><td>22.09.2026</td><td>Salariu</td><td>9.200,00</td></tr></table></body></html>';
    expect(htmlTableRows(html)[1]).toEqual(["21.09.2026", "KAUFLAND 5920 CLUJ", "-312,40"]);
    const bytes = new TextEncoder().encode(html);
    const parsed = await readStatementFile(bytes.buffer.slice(0));
    expect(parsed.rows.map((row) => [row.date, row.amount, row.kind])).toEqual([["2026-09-21", 312.4, "expense"], ["2026-09-22", 9200, "income"]]);
  });

  it("explică .xls-ul vechi în loc să citească gunoi", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]).buffer;
    await expect(readStatementFile(ole)).rejects.toThrow(/\.xls/);
  });

  it("lasă CSV-ul pe drumul lui", async () => {
    const parsed = await readStatementFile(new TextEncoder().encode("Data;Descriere;Suma\n21.09.2026;Lidl;-10,50").buffer);
    expect(parsed.rows).toHaveLength(1);
  });
});
