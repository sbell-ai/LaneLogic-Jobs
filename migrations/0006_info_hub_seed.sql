-- Migration: info_hub_seed
-- Inserts four CDL cert guide resources for job seekers.
-- All content derived from FMCSA regulations (49 CFR Part 383) and
-- federal agency publications. No copyrighted text reproduced verbatim.
-- Sources: fmcsa.dot.gov, ecfr.gov/current/title-49/.../part-383

INSERT INTO resources (title, slug, intro_text, body_text, content, target_audience, required_tier, is_published, published_at, created_at, updated_at)
VALUES

-- 1. CDL Classes
(
  'CDL Classes Explained: A, B, and C',
  'cdl-classes-explained',
  'Not all commercial driver''s licenses are the same. The class on your CDL determines which vehicles you can legally operate — and which jobs you qualify for.',
  'Under 49 CFR Part 383, there are three classes of CDL. Each is defined by the gross vehicle weight rating (GVWR) or gross combination weight rating (GCWR) of the vehicle being operated.

**Class A** authorizes operation of any combination of vehicles with a GCWR of 26,001 pounds or more, where the towed vehicle has a GVWR exceeding 10,000 pounds. Tractor-trailers, flatbeds, tankers, and livestock carriers typically require a Class A CDL. A Class A holder may also operate Class B and C vehicles when holding the applicable endorsements.

**Class B** authorizes operation of any single vehicle with a GVWR of 26,001 pounds or more, or such a vehicle towing another vehicle with a GVWR not exceeding 10,000 pounds. Straight trucks, large passenger buses, and segmented buses commonly require a Class B CDL.

**Class C** applies to vehicles not meeting the Class A or B weight thresholds, but which are designed to transport 16 or more passengers (including the driver), or which are required to be placarded for hazardous materials. A Class C CDL with the appropriate endorsements covers small HazMat vehicles and smaller passenger shuttles.

**Hierarchy and downgrade:** A Class A CDL holder may operate Class B and C vehicles with the proper endorsements. A Class B holder may operate Class C vehicles. Drivers may voluntarily downgrade to a lower class at their state DMV.

**Entry-Level Driver Training (ELDT):** As of February 7, 2022, first-time applicants for a Class A or Class B CDL, or those upgrading from Class B to Class A, must complete ELDT from a provider registered in the FMCSA Training Provider Registry (tpr.fmcsa.dot.gov) before taking the CDL skills test.

**What this means for your job search:** Most over-the-road trucking positions require a Class A CDL. Local delivery and refuse operations commonly require Class B. If you hold a Class A, you are generally eligible for Class B and C positions as well — a strong selling point when applying.',
  '',
  'job_seeker',
  'free',
  true,
  NOW(),
  NOW(),
  NOW()
),

-- 2. CDL Endorsements
(
  'CDL Endorsements: What Each Code Means and When You Need One',
  'cdl-endorsements-guide',
  'Endorsements are add-ons to your CDL that authorize you to operate specific vehicle types or carry certain cargo. Many of the highest-paying trucking positions require one or more endorsements.',
  'Under 49 CFR § 383.93, the following federal endorsement codes are standardized across all states. Your state DMV issues the endorsement after you pass the required knowledge test and, where applicable, a skills test.

**H — Hazardous Materials**
Required to transport hazardous materials in quantities that require placarding under federal HazMat regulations. Obtaining or renewing an H endorsement also requires a Transportation Security Administration (TSA) Security Threat Assessment, which includes a background check and fingerprinting. As of February 7, 2022, first-time H endorsement applicants must also complete ELDT before taking the knowledge test. A CDL with an H endorsement expires on a different schedule than a standard CDL — it expires five years from the date the Security Threat Assessment was passed.

**N — Tank Vehicles**
Required to operate a tank vehicle, defined as a CMV designed to transport liquid or gaseous materials in a tank that is either permanently or temporarily attached to the vehicle or chassis, with a rated capacity of 1,000 gallons or more. Note: drivers transporting empty tanks that previously contained HazMat must have both N and H endorsements until the tank has been purged of residue.

**T — Double/Triple Trailers**
Required to pull two or three trailers simultaneously. A knowledge test is required; no separate skills test is mandated at the federal level, though states may differ.

**X — HazMat and Tank Combination**
The X endorsement is a combined authorization covering both the H (HazMat) and N (Tank) endorsements. It is required when transporting hazardous liquids or gases in a tank vehicle requiring placarding. Holding both H and N individually is equivalent.

**P — Passenger**
Required to operate a CMV designed to carry 16 or more passengers, including the driver. First-time P endorsement applicants must complete ELDT and pass both a knowledge test and a skills test in an appropriate passenger vehicle.

**S — School Bus**
Required to operate a school bus as defined under federal regulations. An S endorsement requires a P endorsement as a prerequisite in most states, plus a knowledge test and a skills test in a qualifying school bus. First-time S endorsement applicants must complete ELDT.

**What this means for your job search:** HazMat (H) and Tank (N) endorsements are among the most in-demand in the trucking industry and often command premium pay. Entering your endorsements in your LaneLogic cert profile ensures you appear in employer searches that filter by endorsement.',
  '',
  'job_seeker',
  'free',
  true,
  NOW(),
  NOW(),
  NOW()
),

-- 3. CDL Restrictions
(
  'CDL Restrictions: What the Codes on Your License Actually Mean',
  'cdl-restrictions-guide',
  'Restrictions on your CDL limit the type of vehicle or equipment you can legally operate. Understanding them helps you apply for jobs you are qualified for — and avoid ones you are not.',
  'Restrictions are placed on a CDL when a driver takes the skills test in a vehicle that lacks certain equipment present in other CMVs of the same class. They are standardized under 49 CFR § 383.153. Common federal restriction codes include:

**L — No Air Brakes**
Issued when a driver takes the skills test in a vehicle not equipped with air brakes. A driver with an L restriction may not operate any CMV equipped with air brakes. This is one of the most limiting restrictions in commercial trucking, as the majority of Class A vehicles use air brake systems.

**Z — No Full Air Brakes**
Issued when a driver tests in a vehicle equipped with air-over-hydraulic brakes but not full air brakes. Less restrictive than L, but still limits some vehicle assignments.

**E — No Manual Transmission**
Issued when a driver tests in a vehicle with an automatic transmission. Drivers with an E restriction may not operate CMVs with a manual (stick-shift) transmission.

**O — No Tractor-Trailer**
Issued when a Class A driver takes the skills test in a combination vehicle other than a tractor-trailer (for example, a straight truck with a pintle hook trailer). This restriction prohibits operation of a tractor-trailer combination.

**M — Class B CDL Only (Passenger/School Bus)**
Issued when a driver obtains a passenger or school bus endorsement by testing in a Class B vehicle. Limits the driver to Class B passenger vehicles only.

**N — Class C CDL Only (Passenger/School Bus)**
Issued when a driver obtains a passenger or school bus endorsement by testing in a Class C vehicle. Limits the driver to Class C passenger vehicles only.

**K — Intrastate Only**
Limits the driver to intrastate commerce (within a single state). Commonly issued when a driver does not meet federal medical qualification standards but qualifies under a state medical waiver program.

**Removing restrictions:** Restrictions can generally be removed by retesting in a vehicle equipped with the restricted equipment. Contact your state DMV for the specific process. Note that removing an L, Z, or E restriction is not subject to ELDT requirements per FMCSA guidance.

**What this means for your job search:** Employers screen for restrictions when posting jobs. Entering your restrictions accurately in your LaneLogic cert profile ensures the cert match system reflects your actual qualifications.',
  '',
  'job_seeker',
  'free',
  true,
  NOW(),
  NOW(),
  NOW()
),

-- 4. Experience Requirements
(
  'Experience Requirements in CDL Job Postings: What Employers Are Looking For',
  'cdl-experience-requirements',
  'Years of verifiable driving experience is one of the most common requirements in CDL job postings. Here is what experience requirements mean in practice and how they are typically verified.',
  'Federal regulations do not set a universal minimum years-of-experience requirement for CDL drivers in commercial trucking. However, individual employers set their own experience thresholds based on their insurance requirements, safety programs, and the nature of the operation.

**Common employer experience thresholds:**
- 0–6 months: Entry-level or recent-graduate positions, often at carriers with in-house training programs.
- 6–12 months: The most common minimum for regional and OTR positions at mid-size carriers.
- 1–2 years: Standard for specialized freight, hazmat, and tanker operations.
- 2+ years: Common for high-value freight, team driving programs, and positions with premium pay.

**What counts as verifiable experience:**
Employers typically require experience operating a CMV of the same class and, where applicable, with the same endorsements as the position requires. Experience must generally be verifiable through prior employer records. Military CMV experience is recognized by many carriers and, under certain conditions, may qualify a driver for a skills test waiver when obtaining or upgrading a CDL (49 CFR Part 383).

**ELDT and new CDL holders:**
The Entry-Level Driver Training regulations that took effect February 7, 2022 establish a training baseline for new CDL holders, but completing ELDT does not substitute for employer-defined experience requirements. A new Class A CDL holder who completed ELDT is still a zero-experience driver in the eyes of most carriers.

**Insurance and safety program factors:**
Many experience requirements are set by a carrier''s insurance underwriter rather than by the carrier itself. Insurers commonly require a minimum period of verifiable, violation-free driving history, particularly for HazMat and passenger operations.

**What this means for your job search:** Entering your years of experience in your LaneLogic cert profile allows the cert matching system to surface jobs where you meet the employer''s stated minimum. Jobs where you fall short of the stated minimum will show a partial or no-match indicator.',
  '',
  'job_seeker',
  'free',
  true,
  NOW(),
  NOW(),
  NOW()
);
