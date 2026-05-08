// Federally defined CDL endorsement codes (FMCSA)
export const CDL_ENDORSEMENTS = ["H", "N", "T", "X", "P", "S"] as const;
export type CdlEndorsement = typeof CDL_ENDORSEMENTS[number];

// CDL restriction codes
export const CDL_RESTRICTIONS = ["L", "Z", "E", "O", "M", "N", "K"] as const;
export type CdlRestriction = typeof CDL_RESTRICTIONS[number];

// CDL classes
export const CDL_CLASSES = ["A", "B", "C"] as const;
export type CdlClass = typeof CDL_CLASSES[number];

// Zod schemas for reuse in insert/update validators
import { z } from "zod";

export const cdlEndorsementSchema = z.enum(CDL_ENDORSEMENTS);
export const cdlRestrictionSchema = z.enum(CDL_RESTRICTIONS);
export const cdlClassSchema = z.enum(CDL_CLASSES).nullable();

export const seekerCertSchema = z.object({
  cdlClass: cdlClassSchema.optional(),
  cdlState: z.string().length(2).toUpperCase().nullable().optional(),
  cdlEndorsements: z.array(cdlEndorsementSchema).default([]),
  cdlRestrictions: z.array(cdlRestrictionSchema).default([]),
  cdlExpiresAt: z.coerce.date().nullable().optional(),
  yearsExperience: z.number().int().min(0).max(50).nullable().optional(),
  // Convenience booleans — always derived from endorsements on save
  hasHazmat: z.boolean().default(false),
  hasTanker: z.boolean().default(false),
  hasDoubleTriple: z.boolean().default(false),
  hasPassenger: z.boolean().default(false),
  hasSchoolBus: z.boolean().default(false),
});

export const jobCertRequirementsSchema = z.object({
  cdlRequired: z.boolean().default(false),
  cdlClassRequired: z.enum([...CDL_CLASSES, "none"]).nullable().optional(),
  cdlEndorsementsRequired: z.array(cdlEndorsementSchema).default([]),
  cdlRestrictionsAllowed: z.array(cdlRestrictionSchema).default([]),
  minYearsExperience: z.number().int().min(0).max(50).nullable().optional(),
});

// Endorsement → boolean field map — used in storage layer to auto-derive flags
export const ENDORSEMENT_FLAG_MAP: Record<CdlEndorsement, keyof typeof seekerCertSchema.shape> = {
  H: "hasHazmat",
  X: "hasHazmat",   // X = H+N combined, hazmat still applies
  N: "hasTanker",
  T: "hasDoubleTriple",
  P: "hasPassenger",
  S: "hasSchoolBus",
};