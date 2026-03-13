type Variant = "og" | "square";

interface JobData {
  title: string;
  companyName?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  jobType?: string | null;
  salary?: string | null;
}

export function buildJobShareCard(job: JobData, variant: Variant) {
  const width = variant === "square" ? 1080 : 1200;
  const height = variant === "square" ? 1080 : 628;
  const isSquare = variant === "square";

  const title = job.title;
  const company = job.companyName || null;
  const locationParts = [job.locationCity, job.locationState, job.locationCountry].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : null;
  const jobType = job.jobType || null;
  const salary = job.salary || null;

  const detailItems: { label: string; value: string }[] = [];
  if (company) detailItems.push({ label: "Company", value: company });
  if (location) detailItems.push({ label: "Location", value: location });
  if (jobType) detailItems.push({ label: "Type", value: jobType });
  if (salary) detailItems.push({ label: "Salary", value: salary });

  return {
    type: "div" as const,
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between" as const,
        width,
        height,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        padding: isSquare ? 80 : 50,
        fontFamily: "Inter",
        color: "#ffffff",
      },
      children: [
        {
          type: "div" as const,
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
            },
            children: [
              {
                type: "div" as const,
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center" as const,
                    marginBottom: isSquare ? 40 : 24,
                  },
                  children: [
                    {
                      type: "div" as const,
                      props: {
                        style: {
                          fontSize: isSquare ? 28 : 22,
                          fontWeight: 700,
                          color: "#f97316",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase" as const,
                        },
                        children: "LaneLogic Jobs",
                      },
                    },
                  ],
                },
              },
              {
                type: "div" as const,
                props: {
                  style: {
                    fontSize: isSquare ? 52 : 40,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    marginBottom: isSquare ? 40 : 24,
                    maxHeight: isSquare ? 200 : 120,
                    overflow: "hidden" as const,
                  },
                  children: title,
                },
              },
              ...detailItems.map((item) => ({
                type: "div" as const,
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center" as const,
                    marginBottom: isSquare ? 20 : 12,
                  },
                  children: [
                    {
                      type: "div" as const,
                      props: {
                        style: {
                          fontSize: isSquare ? 22 : 18,
                          color: "#94a3b8",
                          minWidth: isSquare ? 120 : 100,
                        },
                        children: item.label,
                      },
                    },
                    {
                      type: "div" as const,
                      props: {
                        style: {
                          fontSize: isSquare ? 26 : 20,
                          fontWeight: 700,
                          color: "#e2e8f0",
                        },
                        children: item.value,
                      },
                    },
                  ],
                },
              })),
            ],
          },
        },
        {
          type: "div" as const,
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between" as const,
              alignItems: "center" as const,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: isSquare ? 30 : 20,
            },
            children: [
              {
                type: "div" as const,
                props: {
                  style: {
                    fontSize: isSquare ? 22 : 18,
                    color: "#94a3b8",
                  },
                  children: "lanelogicjobs.com",
                },
              },
              {
                type: "div" as const,
                props: {
                  style: {
                    fontSize: isSquare ? 20 : 16,
                    color: "#f97316",
                    fontWeight: 700,
                  },
                  children: "View Job →",
                },
              },
            ],
          },
        },
      ],
    },
  };
}
