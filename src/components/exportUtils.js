/* =============================================================================
   exportUtils.js — CSV / Excel / PDF export with no external libraries.
   -----------------------------------------------------------------------------
   Why no SheetJS or jsPDF:
     • CSV  — plain text, opens natively in Excel.
     • Excel — an HTML table served with Excel's MIME type and namespace. Excel
               and LibreOffice both open this as a real, styled worksheet. The
               file is .xls (HTML-flavoured), not binary .xlsx.
     • PDF  — a print-styled window handed to the browser's own PDF engine,
               which every modern browser has built in.
   If you later need true binary .xlsx or server-generated PDFs, swap these two
   functions for SheetJS / pdfkit — the call signatures can stay identical.
   ========================================================================== */

/** Escapes a value for CSV, guarding the Excel formula-injection case. */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // A leading =, +, -, or @ makes Excel treat the cell as a formula.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/* --------------------------------------------------------------------- CSV */
export function exportCSV(rows, columns, filenameBase = "givt-users") {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(",")).join("\r\n");
  // BOM so Excel reads UTF-8 correctly — without it, non-ASCII names break.
  const csv = "\uFEFF" + header + "\r\n" + body;
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filenameBase}-${stamp()}.csv`);
}

/* ------------------------------------------------------------------- Excel */
export function exportExcel(rows, columns, filenameBase = "givt-users", meta = {}) {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map((r) =>
    `<tr>${columns.map((c) => {
      const v = c.get(r);
      const isNum = typeof v === "number";
      return `<td${isNum ? ' style="mso-number-format:0"' : ""}>${escapeHtml(v)}</td>`;
    }).join("")}</tr>`
  ).join("");

  const metaRows = Object.entries(meta)
    .map(([k, v]) => `<tr><td class="k">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>GIVT Users</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
  </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    th { background: #1F4E79; color: #fff; font-weight: bold; border: 1px solid #16405f;
         padding: 6px 10px; text-align: left; }
    td { border: 1px solid #D0D7DE; padding: 5px 10px; }
    tr:nth-child(even) td { background: #F4F7FA; }
    .title { font-size: 15pt; font-weight: bold; color: #1F4E79; }
    .k { font-weight: bold; background: #EFE7D6; }
  </style>
</head>
<body>
  <p class="title">GIVT Platform — User Report</p>
  ${metaRows ? `<table>${metaRows}</table><br/>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

  triggerDownload(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `${filenameBase}-${stamp()}.xls`
  );
}

/* --------------------------------------------------------------------- PDF */
/** Opens a print-ready window; the user picks "Save as PDF" in the dialog. */
export function exportPDF(rows, columns, filenameBase = "givt-users", meta = {}) {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map((r) =>
    `<tr>${columns.map((c) => `<td>${escapeHtml(c.get(r))}</td>`).join("")}</tr>`
  ).join("");

  const metaHtml = Object.entries(meta)
    .map(([k, v]) => `<span><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span>`)
    .join("");

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    alert("Please allow pop-ups for this site to generate the PDF.");
    return;
  }

  win.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filenameBase)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "DM Sans", Arial, sans-serif; color: #0E1116; margin: 0; padding: 18px; }
    h1 { font-size: 19px; margin: 0 0 4px; color: #8C6420; letter-spacing: -.2px; }
    .sub { font-size: 11px; color: #6B7280; margin-bottom: 12px; }
    .meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: 10.5px; color: #2A2F3A;
            background: #F7F3EC; border: 1px solid #D8CFBE; border-radius: 6px;
            padding: 8px 12px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    th { background: #2D6E6A; color: #fff; text-align: left; padding: 6px 7px;
         border: 1px solid #1F4A47; font-weight: 600; }
    td { border: 1px solid #D8CFBE; padding: 5px 7px; }
    tr:nth-child(even) td { background: #FAF8F3; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .foot { margin-top: 14px; font-size: 9px; color: #6B7280; text-align: right; }
    @media print { .no-print { display: none !important; } }
    .no-print { text-align: center; margin-bottom: 14px; }
    .no-print button { font: inherit; font-size: 13px; padding: 9px 22px; cursor: pointer;
      background: #B8862F; color: #fff; border: none; border-radius: 7px; font-weight: 600; }
  </style></head><body>
  <div class="no-print">
    <button onclick="window.print()">Save as PDF / Print</button>
  </div>
  <h1>GIVT Platform — User Report</h1>
  <div class="sub">Generated ${new Date().toLocaleString()}</div>
  ${metaHtml ? `<div class="meta">${metaHtml}</div>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <div class="foot">${rows.length} record${rows.length === 1 ? "" : "s"} · GIVT — Gamified, Individualized, Verified Talent</div>
  </body></html>`);
  win.document.close();
}

/** Column definitions shared by all three exporters. */
export const USER_EXPORT_COLUMNS = [
  { label: "Name",          get: (u) => u.name },
  { label: "Email",         get: (u) => u.email || "—" },
  { label: "Role",          get: (u) => u.role },
  { label: "Status",        get: (u) => (u.isActive ? "Active" : "Deactivated") },
  { label: "Email Verified",get: (u) => (u.emailVerified ? "Yes" : "No") },
  { label: "Token Balance", get: (u) => u.wallet?.balance ?? 0 },
  { label: "Last Login",    get: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never") },
  { label: "Registered",    get: (u) => new Date(u.createdAt).toLocaleDateString() },
  { label: "User ID",       get: (u) => u.id },
];
