import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { validateCategoryPair, normalizeCategory, normalizeSubcategory } from "@shared/jobTaxonomy";
import { validateKeywords } from "../taggingValidator";

export const LANELOGIC_OWNED_DOMAINS: string[] = (process.env.LANELOGIC_OWNED_DOMAINS || "lanelogicjobs.com,lanelogic.com")
  .split(",").map(d => d.trim().toLowerCase()).filter(Boolean);

export function isLaneLogicDomain(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return LANELOGIC_OWNED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.some(c => c !== "")) lines.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  current.push(field.trim());
  if (current.some(c => c !== "")) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.replace(/^﻿/, ""));
  return { headers, rows: lines.slice(1) };
}

export interface RowError {
  rowNumber: number;
  field: string;
  errorCode: string;
  errorMessage: string;
}

export function paragraphize(text: string): string {
  const newlineCount = (text.match(/\n/g) || []).length;
  if (newlineCount >= 2) return text;
  return text.replace(/([.?!])\s+/g, "$1\n\n");
}

export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function validateAndMapCsvRow(
  record: Record<string, string>,
  rowNumber: number,
  employerId: number,
): { job: any; errors: RowError[] } {
  const errors: RowError[] = [];
  const get = (key: string) => (record[key] || "").trim();

  const externalJobKey = get("externalJobKey");
  if (!externalJobKey) {
    errors.push({ rowNumber, field: "externalJobKey", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "externalJobKey is required" });
  }

  const title = get("title");
  if (!title) {
    errors.push({ rowNumber, field: "title", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "title is required" });
  }

  const description = get("description");
  if (!description) {
    errors.push({ rowNumber, field: "description", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "description is required" });
  }

  const requirements = get("requirements");
  if (!requirements) {
    errors.push({ rowNumber, field: "requirements", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "requirements is required" });
  }

  const rawCategory = get("category") || null;
  const rawSubcategory = get("subcategory") || null;
  let category: string | null = null;
  let subcategory: string | null = null;
  if (rawCategory) {
    const normalizedCat = normalizeCategory(rawCategory);
    if (!normalizedCat) {
      errors.push({ rowNumber, field: "category", errorCode: "INVALID_CATEGORY", errorMessage: `Category "${rawCategory}" is not a valid taxonomy category.` });
    } else {
      category = normalizedCat;
    }
  }
  if (rawSubcategory && !rawCategory) {
    errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: `Subcategory "${rawSubcategory}" provided without a category.` });
  } else if (rawSubcategory && rawCategory && !category) {
    errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: `Subcategory "${rawSubcategory}" provided with invalid category "${rawCategory}".` });
  } else if (rawSubcategory && category) {
    const normalizedSub = normalizeSubcategory(category, rawSubcategory);
    if (!normalizedSub) {
      errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_SUBCATEGORY", errorMessage: `Subcategory "${rawSubcategory}" is not valid for category "${category}".` });
    } else {
      subcategory = normalizedSub;
    }
  }
  const catPairResult = validateCategoryPair(category, subcategory);
  if (!catPairResult.valid) {
    errors.push({ rowNumber, field: "category", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: catPairResult.error! });
  }

  let salary: string | null = null;
  const salaryMin = get("salaryMin");
  const salaryMax = get("salaryMax");
  const salaryUnit = get("salaryUnit") || "year";
  if (salaryMin || salaryMax) {
    if (salaryMin && isNaN(Number(salaryMin))) {
      errors.push({ rowNumber, field: "salaryMin", errorCode: "INVALID_NUMBER", errorMessage: `salaryMin "${salaryMin}" is not a valid number` });
    }
    if (salaryMax && isNaN(Number(salaryMax))) {
      errors.push({ rowNumber, field: "salaryMax", errorCode: "INVALID_NUMBER", errorMessage: `salaryMax "${salaryMax}" is not a valid number` });
    }
    if (salaryMin && salaryMax && !isNaN(Number(salaryMin)) && !isNaN(Number(salaryMax)) && Number(salaryMin) > Number(salaryMax)) {
      errors.push({ rowNumber, field: "salaryMin", errorCode: "MIN_GT_MAX", errorMessage: `salaryMin (${salaryMin}) is greater than salaryMax (${salaryMax})` });
    }
    if (!errors.some(e => e.field === "salaryMin" || e.field === "salaryMax")) {
      const parts = [];
      if (salaryMin) parts.push(salaryMin);
      if (salaryMax) parts.push(salaryMax);
      salary = parts.join("-") + `/${salaryUnit}`;
    }
  }

  const applyUrl = get("applyUrl") || null;
  let isExternalApply = false;
  if (applyUrl) {
    try {
      new URL(applyUrl);
      isExternalApply = !isLaneLogicDomain(applyUrl);
    } catch {
      errors.push({ rowNumber, field: "applyUrl", errorCode: "INVALID_URL", errorMessage: `applyUrl "${applyUrl}" is not a valid URL` });
    }
  }

  const employerUrlRaw = get("employerUrl") || null;
  let employerUrl: string | null = null;
  if (employerUrlRaw) {
    try {
      new URL(employerUrlRaw);
      employerUrl = employerUrlRaw;
    } catch {
      errors.push({ rowNumber, field: "employerUrl", errorCode: "INVALID_URL", errorMessage: `employerUrl "${employerUrlRaw}" is not a valid URL` });
    }
  }

  const expiresAtRaw = get("expiresAt") || null;
  let parsedExpiresAt: Date = daysFromNow(30);
  if (expiresAtRaw) {
    const d = new Date(expiresAtRaw);
    if (isNaN(d.getTime())) {
      errors.push({ rowNumber, field: "expiresAt", errorCode: "INVALID_DATE", errorMessage: `expiresAt "${expiresAtRaw}" is not a valid date` });
    } else if (d <= new Date()) {
      errors.push({ rowNumber, field: "expiresAt", errorCode: "PAST_DATE", errorMessage: `expiresAt "${expiresAtRaw}" must be a future date` });
    } else {
      parsedExpiresAt = d;
    }
  }

  const coreResponsibilities = get("coreResponsibilities") || null;
  const ALLOWED_EXPERIENCE_BANDS = new Set(["0-2", "2-5", "5-10", "10+"]);
  const experienceLevelYears = get("experienceLevelYears") || get("experienceLevel") || null;
  if (experienceLevelYears && !ALLOWED_EXPERIENCE_BANDS.has(experienceLevelYears)) {
    errors.push({ rowNumber, field: "experienceLevelYears", errorCode: "INVALID_EXPERIENCE_LEVEL", errorMessage: `experienceLevelYears "${experienceLevelYears}" is not valid. Allowed values: 0-2, 2-5, 5-10, 10+` });
  }
  const ALLOWED_WORK_LOCATION_TYPES = new Set(["remote", "hybrid", "on_site", "otr", "field_based"]);
  const rawWorkLocationType = get("workLocationType") || null;
  if (rawWorkLocationType && !ALLOWED_WORK_LOCATION_TYPES.has(rawWorkLocationType)) {
    errors.push({ rowNumber, field: "workLocationType", errorCode: "INVALID_WORK_LOCATION_TYPE", errorMessage: `workLocationType "${rawWorkLocationType}" is not valid. Allowed values: remote, hybrid, on_site, otr, field_based` });
  }

  const skillsRaw = get("skills");
  const keywordsRaw = get("keywords");
  const rawSkills = skillsRaw ? skillsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
  const rawKeywords = keywordsRaw ? keywordsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  if (rawSkills.length > 0) {
    const skillsResult = validateKeywords(rawSkills);
    if (!skillsResult.valid) {
      for (const err of skillsResult.errors) {
        errors.push({ rowNumber, field: "skills", errorCode: err.errorCode, errorMessage: err.errorMessage });
      }
    }
  }

  if (rawKeywords.length > 0) {
    const keywordsResult = validateKeywords(rawKeywords);
    if (!keywordsResult.valid) {
      for (const err of keywordsResult.errors) {
        errors.push({ rowNumber, field: "keywords", errorCode: err.errorCode, errorMessage: err.errorMessage });
      }
    }
  }

  const jobMetadata: Record<string, any> = {};
  if (coreResponsibilities) jobMetadata.coreResponsibilities = coreResponsibilities;
  if (experienceLevelYears && ALLOWED_EXPERIENCE_BANDS.has(experienceLevelYears)) jobMetadata.experienceLevelYears = experienceLevelYears;
  if (rawSkills.length > 0) jobMetadata.rawSkills = rawSkills;
  if (rawKeywords.length > 0) jobMetadata.rawKeywords = rawKeywords;

  const job = {
    employerId,
    externalJobKey: externalJobKey || null,
    title: title || "",
    companyName: get("companyName") || null,
    jobType: get("jobType") || null,
    category,
    subcategory,
    industry: get("industry") || null,
    description: paragraphize(description || ""),
    requirements: requirements || "",
    benefits: get("benefits") || null,
    locationCity: get("locationCity") || null,
    locationState: get("locationState") || null,
    locationCountry: get("locationCountry") || null,
    workLocationType: rawWorkLocationType && ALLOWED_WORK_LOCATION_TYPES.has(rawWorkLocationType) ? rawWorkLocationType : null,
    salary,
    applyUrl,
    employerUrl,
    isExternalApply,
    isPublished: true,
    publishedAt: new Date(),
    expiresAt: parsedExpiresAt,
    jobMetadata: Object.keys(jobMetadata).length > 0 ? jobMetadata : null,
  };

  return { job, errors };
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const csvDiskStorage = multer.diskStorage({
  destination: path.join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const MAX_CSV_FILE_BYTES = parseInt(process.env.MAX_CSV_FILE_BYTES || String(10 * 1024 * 1024), 10);
export const MAX_CSV_ROWS = parseInt(process.env.MAX_CSV_ROWS || "5000", 10);

export const csvUpload = multer({
  storage: csvDiskStorage,
  limits: { fileSize: MAX_CSV_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// Shared rate-limit map for email test sends (used by both email-templates and email-cron-configs)
export const testEmailRateLimit = new Map<number, number>();
