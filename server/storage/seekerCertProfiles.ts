import { db } from "../db";
import { seekerCertProfiles, type SeekerCertProfile } from "@shared/schema";
import { ENDORSEMENT_FLAG_MAP, seekerCertSchema, type CdlEndorsement } from "@shared/certEnums";
import { eq } from "drizzle-orm";
import { z } from "zod";

type SeekerCertInput = z.infer<typeof seekerCertSchema>;

function deriveFlags(endorsements: CdlEndorsement[]) {
  const flags = {
    hasHazmat: false,
    hasTanker: false,
    hasDoubleTriple: false,
    hasPassenger: false,
    hasSchoolBus: false,
  };
  for (const e of endorsements) {
    const key = ENDORSEMENT_FLAG_MAP[e];
    if (key && key in flags) (flags as any)[key] = true;
  }
  return flags;
}

export const seekerCertStorage = {
  async getCertProfile(userId: number): Promise<SeekerCertProfile | null> {
    const rows = await db.select().from(seekerCertProfiles).where(eq(seekerCertProfiles.userId, userId));
    return rows[0] ?? null;
  },

  async upsertCertProfile(userId: number, data: SeekerCertInput): Promise<SeekerCertProfile> {
    const flags = deriveFlags(data.cdlEndorsements);
    const values = {
      userId,
      cdlClass: data.cdlClass ?? null,
      cdlState: data.cdlState ?? null,
      cdlEndorsements: data.cdlEndorsements,
      cdlRestrictions: data.cdlRestrictions,
      cdlExpiresAt: data.cdlExpiresAt ?? null,
      yearsExperience: data.yearsExperience ?? null,
      ...flags,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(seekerCertProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: seekerCertProfiles.userId,
        set: {
          cdlClass: values.cdlClass,
          cdlState: values.cdlState,
          cdlEndorsements: values.cdlEndorsements,
          cdlRestrictions: values.cdlRestrictions,
          cdlExpiresAt: values.cdlExpiresAt,
          yearsExperience: values.yearsExperience,
          ...flags,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    return row;
  },
};
