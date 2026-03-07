export interface JobCategory {
  slug: string;
  label: string;
  match: string[];
}

export const JOB_CATEGORIES: JobCategory[] = [
  { slug: "cdl", label: "CDL Driver Jobs", match: ["cdl", "commercial driver", "class a", "class b"] },
  { slug: "tanker", label: "Tanker Driver Jobs", match: ["tanker", "tank driver", "liquid bulk"] },
  { slug: "flatbed", label: "Flatbed Driver Jobs", match: ["flatbed", "flat bed", "open deck"] },
  { slug: "owner-operator", label: "Owner Operator Jobs", match: ["owner operator", "owner-operator", "independent contractor"] },
  { slug: "local", label: "Local CDL Jobs", match: ["local", "local cdl", "home daily", "day cab"] },
  { slug: "hazmat", label: "Hazmat Driver Jobs", match: ["hazmat", "haz-mat", "hazardous material"] },
  { slug: "otr", label: "OTR Driver Jobs", match: ["otr", "over the road", "long haul", "over-the-road"] },
  { slug: "dispatcher", label: "Dispatcher Jobs", match: ["dispatcher", "dispatch", "logistics coordinator"] },
  { slug: "mechanic", label: "Mechanic Jobs", match: ["mechanic", "technician", "diesel mechanic", "fleet maintenance"] },
  { slug: "warehouse", label: "Warehouse Jobs", match: ["warehouse", "dock worker", "forklift", "loading"] },
];

export function findCategoryBySlug(slug: string): JobCategory | undefined {
  return JOB_CATEGORIES.find((c) => c.slug === slug);
}

export const US_STATES: Record<string, string> = {
  alabama: "Alabama", alaska: "Alaska", arizona: "Arizona", arkansas: "Arkansas", california: "California",
  colorado: "Colorado", connecticut: "Connecticut", delaware: "Delaware", florida: "Florida", georgia: "Georgia",
  hawaii: "Hawaii", idaho: "Idaho", illinois: "Illinois", indiana: "Indiana", iowa: "Iowa",
  kansas: "Kansas", kentucky: "Kentucky", louisiana: "Louisiana", maine: "Maine", maryland: "Maryland",
  massachusetts: "Massachusetts", michigan: "Michigan", minnesota: "Minnesota", mississippi: "Mississippi", missouri: "Missouri",
  montana: "Montana", nebraska: "Nebraska", nevada: "Nevada", "new-hampshire": "New Hampshire", "new-jersey": "New Jersey",
  "new-mexico": "New Mexico", "new-york": "New York", "north-carolina": "North Carolina", "north-dakota": "North Dakota", ohio: "Ohio",
  oklahoma: "Oklahoma", oregon: "Oregon", pennsylvania: "Pennsylvania", "rhode-island": "Rhode Island", "south-carolina": "South Carolina",
  "south-dakota": "South Dakota", tennessee: "Tennessee", texas: "Texas", utah: "Utah", vermont: "Vermont",
  virginia: "Virginia", washington: "Washington", "west-virginia": "West Virginia", wisconsin: "Wisconsin", wyoming: "Wyoming",
  dc: "District of Columbia",
};

export const STATE_ABBREV: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new-hampshire": "NH", "new-jersey": "NJ",
  "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC", "north-dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode-island": "RI", "south-carolina": "SC",
  "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west-virginia": "WV", wisconsin: "WI", wyoming: "WY",
  dc: "DC", "district-of-columbia": "DC",
};
