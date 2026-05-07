import { Router } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import {
  parseCsvText,
  validateAndMapCsvRow,
  csvUpload,
  MAX_CSV_FILE_BYTES,
  MAX_CSV_ROWS,
  type RowError,
} from "./helpers";

const router = Router();

router.post(api.uploads.csv.path, (req, res) => {
  res.json({ message: "CSV uploaded successfully", count: 10 });
});

router.post("/api/admin/jobs/import", (req, res, next) => {
  csvUpload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `File exceeds maximum size of ${Math.round(MAX_CSV_FILE_BYTES / (1024 * 1024))} MB`,
        });
      }
      return res.status(400).json({ message: err.message || "File upload error" });
    }
    next();
  });
}, async (req, res) => {
  let run: any = null;
  try {
    if (!requireAdminSession(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = req.user as any;
    const fileBuffer = await import("fs").then(fs => fs.readFileSync(req.file!.path));
    const csvText = fileBuffer.toString("utf-8");
    const fileHash = createHash("sha256").update(csvText).digest("hex");

    run = await storage.createImportRun({
      employerId: user.id,
      uploadedBy: user.id,
      filename: req.file.originalname,
      fileHash,
      rowsTotal: 0,
      rowsImported: 0,
      rowsSkipped: 0,
      status: "Processing",
    });

    const { headers, rows } = parseCsvText(csvText);
    if (headers.length === 0) {
      await storage.updateImportRun(run.id, { status: "Failed", rowsTotal: 0 });
      return res.status(400).json({ message: "CSV file is empty or has no headers", runId: run.id });
    }

    if (rows.length > MAX_CSV_ROWS) {
      await storage.updateImportRun(run.id, { status: "Failed", rowsTotal: rows.length });
      return res.status(400).json({
        message: `CSV contains ${rows.length} data rows, which exceeds the maximum of ${MAX_CSV_ROWS}`,
        runId: run.id,
      });
    }

    const allErrors: RowError[] = [];
    let imported = 0;
    let skipped = 0;

    // Pre-resolve employer profiles for unique company names in this CSV
    const companyEmployerMap = new Map<string, number>();
    for (const row of rows) {
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => { record[h] = row[idx] || ""; });
      const companyName = (record["companyName"] || "").trim();
      if (companyName && !companyEmployerMap.has(companyName.toLowerCase())) {
        try {
          const employer = await storage.findOrCreateEmployerByCompanyName(companyName);
          companyEmployerMap.set(companyName.toLowerCase(), employer.id);
        } catch {
          // Fall back to uploader's ID if employer creation fails
          companyEmployerMap.set(companyName.toLowerCase(), user.id);
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => { record[h] = row[idx] || ""; });

      const companyName = (record["companyName"] || "").trim();
      const resolvedEmployerId = companyName
        ? (companyEmployerMap.get(companyName.toLowerCase()) ?? user.id)
        : user.id;

      const { job, errors } = validateAndMapCsvRow(record, i + 2, resolvedEmployerId);

      if (errors.length > 0) {
        allErrors.push(...errors);
        skipped++;
        continue;
      }

      try {
        await storage.upsertJobByExternalKey(resolvedEmployerId, job.externalJobKey!, job);
        imported++;
      } catch (dbErr: any) {
        allErrors.push({
          rowNumber: i + 2,
          field: "_db",
          errorCode: "DB_ERROR",
          errorMessage: dbErr.message || "Database error during upsert",
        });
        skipped++;
      }
    }

    const status = skipped === 0 ? "Completed" : "Completed with errors";

    await storage.updateImportRun(run.id, {
      rowsTotal: rows.length,
      rowsImported: imported,
      rowsSkipped: skipped,
      status,
    });

    if (allErrors.length > 0) {
      const sanitizeCsvCell = (val: string) => {
        let s = val.replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s}"`;
      };
      const errorCsvHeaders = "rowNumber,field,errorCode,errorMessage";
      const errorCsvRows = allErrors.map(e =>
        `${e.rowNumber},${sanitizeCsvCell(e.field)},${sanitizeCsvCell(e.errorCode)},${sanitizeCsvCell(e.errorMessage)}`
      );
      const errorCsv = [errorCsvHeaders, ...errorCsvRows].join("\n");

      await storage.createImportArtifact({
        runId: run.id,
        filename: "error_report.csv",
        contentType: "text/csv",
        data: errorCsv,
      });
    }

    const hasErrors = allErrors.length > 0;
    const response: Record<string, any> = {
      runId: run.id,
      status,
      rowsTotal: rows.length,
      rowsImported: imported,
      rowsSkipped: skipped,
      hasErrors,
    };
    if (hasErrors) {
      response.errorReportUrl = `/api/admin/jobs/import/${run.id}/error-report`;
    }
    res.json(response);
  } catch (err: any) {
    console.error("Import error:", err);
    if (run) {
      try { await storage.updateImportRun(run.id, { status: "Failed" }); } catch {}
    }
    res.status(500).json({ message: "Import failed: " + (err.message || "Unknown error") });
  }
});

router.get("/api/admin/jobs/import/runs", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const runs = await storage.getImportRuns();
  res.json(runs);
});

router.get("/api/admin/jobs/import/:runId", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const run = await storage.getImportRun(Number(req.params.runId));
  if (!run) return res.status(404).json({ message: "Import run not found" });
  res.json(run);
});

router.get("/api/admin/jobs/import/:runId/error-report", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const artifact = await storage.getImportArtifact(Number(req.params.runId), "error_report.csv");
  if (!artifact) return res.status(404).json({ message: "Error report not found" });
  res.set("Content-Type", "text/csv");
  res.set("Content-Disposition", `attachment; filename="error_report_run_${req.params.runId}.csv"`);
  res.send(artifact.data);
});

export default router;
