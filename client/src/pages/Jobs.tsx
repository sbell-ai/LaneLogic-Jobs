import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search, MapPin, Briefcase, DollarSign, ExternalLink, Clock, Building2,
  Filter, X, ChevronDown, ChevronUp, Truck, RotateCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job, Category } from "@shared/schema";
import { formatDistanceToNow, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

function fmtLoc(job: Job) {
  return [job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ");
}

function parseSalaryRange(salary: string | null | undefined): { min: number; max: number } | null {
  if (!salary) return null;
  const s = salary.toLowerCase();
  const numbers: number[] = [];
  const regex = /\$?\s*([\d,]+(?:\.\d+)?)/g;
  let match;
  while ((match = regex.exec(s)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(num) && num > 0) numbers.push(num);
  }
  if (numbers.length === 0) return null;

  let minVal = Math.min(...numbers);
  let maxVal = Math.max(...numbers);

  const isHourly = s.includes("/hr") || s.includes("per hour") || s.includes("hourly") || s.includes("/hour");
  if (isHourly || (maxVal <= 150 && !s.includes("k"))) {
    minVal = minVal * 2080;
    maxVal = maxVal * 2080;
  } else if (s.includes("k")) {
    if (minVal < 1000) minVal = minVal * 1000;
    if (maxVal < 1000) maxVal = maxVal * 1000;
  }

  return { min: minVal, max: maxVal };
}

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const SECTORS = ["Trucking", "Logistics", "Freight Brokerage", "Supply Chain", "Warehousing", "Fleet Management"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior"];
const CDL_OPTIONS = ["Yes", "No"];
const WORK_ENVIRONMENTS = ["Remote", "Hybrid", "On-site"];
const DRIVER_TYPES = ["OTR", "Regional", "Local"];

const SALARY_MAX = 250000;

type FilterSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button
        className="flex items-center justify-between w-full text-left font-semibold text-sm text-foreground mb-2"
        onClick={() => setOpen(!open)}
        data-testid={`filter-section-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

type CheckboxFilterProps = {
  items: string[];
  selected: string[];
  onChange: (items: string[]) => void;
  testIdPrefix: string;
};

function CheckboxFilter({ items, selected, onChange, testIdPrefix }: CheckboxFilterProps) {
  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <label
          key={item}
          className="flex items-center gap-2.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Checkbox
            checked={selected.includes(item)}
            onCheckedChange={() => toggle(item)}
            data-testid={`${testIdPrefix}-${item.toLowerCase().replace(/\s+/g, "-")}`}
          />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

function formatSalary(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

export default function Jobs() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [query, setQuery] = useState(params.get("q") || "");
  const [locationFilter, setLocationFilter] = useState(params.get("loc") || "");
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [cdlRequired, setCdlRequired] = useState<string[]>([]);
  const [workEnvironments, setWorkEnvironments] = useState<string[]>([]);
  const [driverTypes, setDriverTypes] = useState<string[]>([]);
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, SALARY_MAX]);
  const [recentOnly, setRecentOnly] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const industries = (categories || []).filter((c) => c.type === "industry");

  const sevenDaysAgo = subDays(new Date(), 7);

  const activeFilterCount =
    jobTypes.length +
    sectors.length +
    experienceLevels.length +
    cdlRequired.length +
    workEnvironments.length +
    driverTypes.length +
    (salaryRange[0] > 0 || salaryRange[1] < SALARY_MAX ? 1 : 0) +
    (recentOnly ? 1 : 0) +
    (remoteOnly ? 1 : 0) +
    (query ? 1 : 0) +
    (locationFilter ? 1 : 0);

  const clearAllFilters = () => {
    setQuery("");
    setLocationFilter("");
    setJobTypes([]);
    setSectors([]);
    setExperienceLevels([]);
    setCdlRequired([]);
    setWorkEnvironments([]);
    setDriverTypes([]);
    setSalaryRange([0, SALARY_MAX]);
    setRecentOnly(false);
    setRemoteOnly(false);
  };

  const filtered = (jobs || []).filter((job) => {
    const matchQuery =
      !query ||
      job.title.toLowerCase().includes(query.toLowerCase()) ||
      job.description.toLowerCase().includes(query.toLowerCase()) ||
      (job.companyName || "").toLowerCase().includes(query.toLowerCase());

    const loc = fmtLoc(job).toLowerCase();
    const matchLoc = !locationFilter || loc.includes(locationFilter.toLowerCase());

    const matchRemote = !remoteOnly || loc.includes("remote") ||
      (job.title || "").toLowerCase().includes("remote") ||
      (job.description || "").toLowerCase().includes("remote");

    const matchJobType = jobTypes.length === 0 || jobTypes.some(
      (t) => (job.jobType || "").toLowerCase() === t.toLowerCase()
    );

    const jobIndustry = (job.industry || "").toLowerCase();
    const jobCategory = (job.category || "").toLowerCase();
    const jobDesc = (job.description || "").toLowerCase();
    const jobTitle = (job.title || "").toLowerCase();
    const matchSector = sectors.length === 0 || sectors.some((s) => {
      const sl = s.toLowerCase();
      return jobIndustry.includes(sl) || jobCategory.includes(sl) || jobDesc.includes(sl) || jobTitle.includes(sl);
    });

    const matchExperience = experienceLevels.length === 0 || experienceLevels.some((lvl) => {
      const ll = lvl.toLowerCase();
      return jobDesc.includes(ll) || jobTitle.includes(ll) || (job.requirements || "").toLowerCase().includes(ll);
    });

    const matchCdl = cdlRequired.length === 0 || cdlRequired.some((opt) => {
      if (opt === "Yes") {
        return jobDesc.includes("cdl") || (job.requirements || "").toLowerCase().includes("cdl") || jobTitle.includes("cdl");
      }
      return !jobDesc.includes("cdl") && !(job.requirements || "").toLowerCase().includes("cdl") && !jobTitle.includes("cdl");
    });

    const matchWorkEnv = workEnvironments.length === 0 || workEnvironments.some((env) => {
      const el = env.toLowerCase();
      return loc.includes(el) || jobTitle.includes(el) || jobDesc.includes(el);
    });

    const matchDriverType = driverTypes.length === 0 || driverTypes.some((dt) => {
      const dl = dt.toLowerCase();
      return jobTitle.includes(dl) || jobDesc.includes(dl) || (job.requirements || "").toLowerCase().includes(dl);
    });

    const salaryParsed = parseSalaryRange(job.salary);
    const matchSalary = (salaryRange[0] === 0 && salaryRange[1] === SALARY_MAX) ||
      !salaryParsed ||
      (salaryParsed.max >= salaryRange[0] && salaryParsed.min <= salaryRange[1]);

    const matchRecent = !recentOnly || (job.createdAt && new Date(job.createdAt) >= sevenDaysAgo);

    return matchQuery && matchLoc && matchRemote && matchJobType && matchSector &&
      matchExperience && matchCdl && matchWorkEnv && matchDriverType && matchSalary && matchRecent;
  });

  const sidebarContent = (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <h2 className="font-bold font-display text-base">Filters</h2>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0" data-testid="badge-active-filter-count">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-testid="button-clear-all-filters"
          >
            <RotateCcw size={12} /> Clear all
          </button>
        )}
      </div>

      <FilterSection title="Search">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            data-testid="input-job-search"
            placeholder="Title, company, or keyword"
            className="pl-8 h-9 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </FilterSection>

      <FilterSection title="Location">
        <div className="relative">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            data-testid="input-location-search"
            placeholder="City or state"
            className="pl-8 h-9 text-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
          <Checkbox
            checked={remoteOnly}
            onCheckedChange={(checked) => setRemoteOnly(checked === true)}
            data-testid="checkbox-remote-only"
          />
          <span>Remote only</span>
        </label>
      </FilterSection>

      <FilterSection title="Job Type">
        <CheckboxFilter
          items={JOB_TYPES}
          selected={jobTypes}
          onChange={setJobTypes}
          testIdPrefix="checkbox-job-type"
        />
      </FilterSection>

      <FilterSection title="Transportation Sector">
        <CheckboxFilter
          items={SECTORS}
          selected={sectors}
          onChange={setSectors}
          testIdPrefix="checkbox-sector"
        />
      </FilterSection>

      {industries.length > 0 && (
        <FilterSection title="Industry" defaultOpen={false}>
          <CheckboxFilter
            items={industries.map((i) => i.name)}
            selected={sectors}
            onChange={setSectors}
            testIdPrefix="checkbox-industry"
          />
        </FilterSection>
      )}

      <FilterSection title="Experience Level">
        <CheckboxFilter
          items={EXPERIENCE_LEVELS}
          selected={experienceLevels}
          onChange={setExperienceLevels}
          testIdPrefix="checkbox-experience"
        />
      </FilterSection>

      <FilterSection title="CDL Required">
        <CheckboxFilter
          items={CDL_OPTIONS}
          selected={cdlRequired}
          onChange={setCdlRequired}
          testIdPrefix="checkbox-cdl"
        />
      </FilterSection>

      <FilterSection title="Work Environment">
        <CheckboxFilter
          items={WORK_ENVIRONMENTS}
          selected={workEnvironments}
          onChange={setWorkEnvironments}
          testIdPrefix="checkbox-work-env"
        />
      </FilterSection>

      <FilterSection title="Driver Type" defaultOpen={false}>
        <CheckboxFilter
          items={DRIVER_TYPES}
          selected={driverTypes}
          onChange={setDriverTypes}
          testIdPrefix="checkbox-driver-type"
        />
      </FilterSection>

      <FilterSection title="Salary Range">
        <div className="px-1 pt-1">
          <Slider
            min={0}
            max={SALARY_MAX}
            step={5000}
            value={salaryRange}
            onValueChange={(val) => setSalaryRange(val as [number, number])}
            data-testid="slider-salary-range"
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-salary-min">{formatSalary(salaryRange[0])}</span>
            <span data-testid="text-salary-max">{salaryRange[1] >= SALARY_MAX ? `${formatSalary(SALARY_MAX)}+` : formatSalary(salaryRange[1])}</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Date Posted">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-muted-foreground">Last 7 days</span>
          <Switch
            checked={recentOnly}
            onCheckedChange={setRecentOnly}
            data-testid="switch-recent-only"
          />
        </label>
      </FilterSection>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-6">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck size={28} className="text-primary" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-jobs-heading">Browse Transportation Jobs</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isLoading ? "Loading..." : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} found`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="lg:hidden flex items-center gap-2"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                data-testid="button-mobile-filters"
              >
                <Filter size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{activeFilterCount}</Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex gap-6">
            <aside className="hidden lg:block w-72 shrink-0" data-testid="sidebar-filters-desktop">
              <div className="sticky top-6 bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto">
                {sidebarContent}
              </div>
            </aside>

            <AnimatePresence>
              {mobileFiltersOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 lg:hidden"
                >
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setMobileFiltersOpen(false)}
                  />
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
                    data-testid="sidebar-filters-mobile"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <h2 className="font-bold font-display text-lg">Filters</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileFiltersOpen(false)}
                        data-testid="button-close-mobile-filters"
                      >
                        <X size={20} />
                      </Button>
                    </div>
                    <div className="p-4">
                      {sidebarContent}
                    </div>
                    <div className="sticky bottom-0 p-4 bg-white dark:bg-slate-900 border-t border-border">
                      <Button
                        className="w-full"
                        onClick={() => setMobileFiltersOpen(false)}
                        data-testid="button-apply-mobile-filters"
                      >
                        Show {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border h-36 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                  <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
                  <h2 className="text-xl font-bold font-display mb-2">No jobs found</h2>
                  <p className="text-muted-foreground mb-4">Try adjusting your search filters.</p>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
                      <RotateCcw size={14} className="mr-2" /> Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link href={`/jobs/${job.id}`}>
                        <div
                          data-testid={`card-job-${job.id}`}
                          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer group"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              {(job as any).employerLogo ? (
                                <img src={(job as any).employerLogo} alt={job.companyName || ""} className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid={`img-company-logo-${job.id}`} />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0" data-testid={`placeholder-company-logo-${job.id}`}>
                                  {(job.companyName || job.title).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <h2 className="text-lg font-bold font-display group-hover:text-primary transition-colors">
                                  {job.title}
                                </h2>
                                {job.companyName && (
                                  <p className="text-sm font-medium text-foreground/70 flex items-center gap-1 mt-0.5">
                                    <Building2 size={13} /> {job.companyName}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                                  {fmtLoc(job) && (
                                    <span className="flex items-center gap-1">
                                      <MapPin size={14} /> {fmtLoc(job)}
                                    </span>
                                  )}
                                  {job.jobType && (
                                    <Badge variant="outline" className="text-xs font-normal">{job.jobType}</Badge>
                                  )}
                                  {job.salary && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign size={14} /> {job.salary}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "Recently"}
                                  </span>
                                  {job.expiresAt && (
                                    <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold hover:bg-amber-100" data-testid={`badge-actively-interviewing-${job.id}`}>
                                      Actively Interviewing: Apply Soon
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {job.isExternalApply && (
                                <Badge variant="outline" className="text-xs">
                                  <ExternalLink size={12} className="mr-1" /> External
                                </Badge>
                              )}
                              <Button size="sm" className="hover-elevate" data-testid={`button-apply-${job.id}`}>
                                Apply Now
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
