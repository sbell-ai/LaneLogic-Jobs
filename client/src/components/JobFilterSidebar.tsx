import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Search, MapPin, Filter, X, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Job, Category } from "@shared/schema";
import { subDays } from "date-fns";
import { getCategories, getSubcategories } from "@shared/jobTaxonomy";

export const SALARY_MAX = 250000;

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const SECTORS = getCategories() as unknown as string[];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior"];
const CDL_OPTIONS = ["Yes", "No"];
const WORK_ENVIRONMENTS = ["Remote", "Hybrid", "On-site"];
const DRIVER_TYPES = ["OTR", "Regional", "Local"];

export function fmtLoc(job: Job) {
  return [job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ");
}

export function parseSalaryRange(salary: string | null | undefined): { min: number; max: number } | null {
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

function formatSalary(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

function CheckboxFilter({ items, selected, onChange, testIdPrefix }: { items: string[]; selected: string[]; onChange: (items: string[]) => void; testIdPrefix: string }) {
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

export type JobFilters = {
  query: string;
  setQuery: (v: string) => void;
  locationFilter: string;
  setLocationFilter: (v: string) => void;
  jobTypes: string[];
  setJobTypes: (v: string[]) => void;
  sectors: string[];
  setSectors: (v: string[]) => void;
  subcategories: string[];
  setSubcategories: (v: string[]) => void;
  experienceLevels: string[];
  setExperienceLevels: (v: string[]) => void;
  cdlRequired: string[];
  setCdlRequired: (v: string[]) => void;
  workEnvironments: string[];
  setWorkEnvironments: (v: string[]) => void;
  driverTypes: string[];
  setDriverTypes: (v: string[]) => void;
  salaryRange: [number, number];
  setSalaryRange: (v: [number, number]) => void;
  recentOnly: boolean;
  setRecentOnly: (v: boolean) => void;
  remoteOnly: boolean;
  setRemoteOnly: (v: boolean) => void;
};

export function useJobFilters(initialQuery = "", initialLocation = ""): JobFilters {
  const [query, setQuery] = useState(initialQuery);
  const [locationFilter, setLocationFilter] = useState(initialLocation);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [cdlRequired, setCdlRequired] = useState<string[]>([]);
  const [workEnvironments, setWorkEnvironments] = useState<string[]>([]);
  const [driverTypes, setDriverTypes] = useState<string[]>([]);
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, SALARY_MAX]);
  const [recentOnly, setRecentOnly] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);

  return {
    query, setQuery, locationFilter, setLocationFilter,
    jobTypes, setJobTypes, sectors, setSectors,
    subcategories, setSubcategories,
    experienceLevels, setExperienceLevels, cdlRequired, setCdlRequired,
    workEnvironments, setWorkEnvironments, driverTypes, setDriverTypes,
    salaryRange, setSalaryRange, recentOnly, setRecentOnly,
    remoteOnly, setRemoteOnly,
  };
}

export function getActiveFilterCount(f: JobFilters): number {
  return (
    f.jobTypes.length +
    f.sectors.length +
    f.subcategories.length +
    f.experienceLevels.length +
    f.cdlRequired.length +
    f.workEnvironments.length +
    f.driverTypes.length +
    (f.salaryRange[0] > 0 || f.salaryRange[1] < SALARY_MAX ? 1 : 0) +
    (f.recentOnly ? 1 : 0) +
    (f.remoteOnly ? 1 : 0) +
    (f.query ? 1 : 0) +
    (f.locationFilter ? 1 : 0)
  );
}

export function clearAllFilters(f: JobFilters) {
  f.setQuery("");
  f.setLocationFilter("");
  f.setJobTypes([]);
  f.setSectors([]);
  f.setSubcategories([]);
  f.setExperienceLevels([]);
  f.setCdlRequired([]);
  f.setWorkEnvironments([]);
  f.setDriverTypes([]);
  f.setSalaryRange([0, SALARY_MAX]);
  f.setRecentOnly(false);
  f.setRemoteOnly(false);
}

export function filterJobs(jobs: Job[], f: JobFilters): Job[] {
  const sevenDaysAgo = subDays(new Date(), 7);
  return jobs.filter((job) => {
    const matchQuery =
      !f.query ||
      job.title.toLowerCase().includes(f.query.toLowerCase()) ||
      job.description.toLowerCase().includes(f.query.toLowerCase()) ||
      (job.companyName || "").toLowerCase().includes(f.query.toLowerCase());

    const loc = fmtLoc(job).toLowerCase();
    const matchLoc = !f.locationFilter || loc.includes(f.locationFilter.toLowerCase());

    const matchRemote = !f.remoteOnly || loc.includes("remote") ||
      (job.title || "").toLowerCase().includes("remote") ||
      (job.description || "").toLowerCase().includes("remote");

    const matchJobType = f.jobTypes.length === 0 || f.jobTypes.some(
      (t) => (job.jobType || "").toLowerCase() === t.toLowerCase()
    );

    const jobCategory = (job.category || "").toLowerCase();
    const jobSubcategory = (job.subcategory || "").toLowerCase();
    const jobDesc = (job.description || "").toLowerCase();
    const jobTitle = (job.title || "").toLowerCase();
    const matchSector = f.sectors.length === 0 || f.sectors.some((s) => jobCategory === s.toLowerCase());

    const matchSubcategory = f.subcategories.length === 0 || f.subcategories.some((s) => jobSubcategory === s.toLowerCase());

    const matchExperience = f.experienceLevels.length === 0 || f.experienceLevels.some((lvl) => {
      const ll = lvl.toLowerCase();
      return jobDesc.includes(ll) || jobTitle.includes(ll) || (job.requirements || "").toLowerCase().includes(ll);
    });

    const matchCdl = f.cdlRequired.length === 0 || f.cdlRequired.some((opt) => {
      if (opt === "Yes") {
        return jobDesc.includes("cdl") || (job.requirements || "").toLowerCase().includes("cdl") || jobTitle.includes("cdl");
      }
      return !jobDesc.includes("cdl") && !(job.requirements || "").toLowerCase().includes("cdl") && !jobTitle.includes("cdl");
    });

    const matchWorkEnv = f.workEnvironments.length === 0 || f.workEnvironments.some((env) => {
      const el = env.toLowerCase();
      return loc.includes(el) || jobTitle.includes(el) || jobDesc.includes(el);
    });

    const matchDriverType = f.driverTypes.length === 0 || f.driverTypes.some((dt) => {
      const dl = dt.toLowerCase();
      return jobTitle.includes(dl) || jobDesc.includes(dl) || (job.requirements || "").toLowerCase().includes(dl);
    });

    const salaryParsed = parseSalaryRange(job.salary);
    const matchSalary = (f.salaryRange[0] === 0 && f.salaryRange[1] === SALARY_MAX) ||
      !salaryParsed ||
      (salaryParsed.max >= f.salaryRange[0] && salaryParsed.min <= f.salaryRange[1]);

    const matchRecent = !f.recentOnly || (job.createdAt && new Date(job.createdAt) >= sevenDaysAgo);

    return matchQuery && matchLoc && matchRemote && matchJobType && matchSector && matchSubcategory &&
      matchExperience && matchCdl && matchWorkEnv && matchDriverType && matchSalary && matchRecent;
  });
}

type SidebarContentProps = {
  filters: JobFilters;
  activeFilterCount: number;
  onClearAll: () => void;
  industries?: Category[];
};

function SidebarContent({ filters: f, activeFilterCount, onClearAll, industries = [] }: SidebarContentProps) {
  return (
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
            onClick={onClearAll}
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
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
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
            value={f.locationFilter}
            onChange={(e) => f.setLocationFilter(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
          <Checkbox
            checked={f.remoteOnly}
            onCheckedChange={(checked) => f.setRemoteOnly(checked === true)}
            data-testid="checkbox-remote-only"
          />
          <span>Remote only</span>
        </label>
      </FilterSection>

      <FilterSection title="Job Type">
        <CheckboxFilter items={JOB_TYPES} selected={f.jobTypes} onChange={f.setJobTypes} testIdPrefix="checkbox-job-type" />
      </FilterSection>

      <FilterSection title="Job Category">
        <CheckboxFilter items={SECTORS} selected={f.sectors} onChange={(v) => { f.setSectors(v); if (v.length === 0) f.setSubcategories([]); }} testIdPrefix="checkbox-sector" />
      </FilterSection>

      {f.sectors.length > 0 && (() => {
        const availableSubs = f.sectors.flatMap(cat => getSubcategories(cat));
        return availableSubs.length > 0 ? (
          <FilterSection title="Subcategory">
            <CheckboxFilter items={availableSubs} selected={f.subcategories} onChange={f.setSubcategories} testIdPrefix="checkbox-subcategory" />
          </FilterSection>
        ) : null;
      })()}

      {industries.length > 0 && (
        <FilterSection title="Industry" defaultOpen={false}>
          <CheckboxFilter items={industries.map((i) => i.name)} selected={f.sectors} onChange={f.setSectors} testIdPrefix="checkbox-industry" />
        </FilterSection>
      )}

      <FilterSection title="Experience Level">
        <CheckboxFilter items={EXPERIENCE_LEVELS} selected={f.experienceLevels} onChange={f.setExperienceLevels} testIdPrefix="checkbox-experience" />
      </FilterSection>

      <FilterSection title="CDL Required">
        <CheckboxFilter items={CDL_OPTIONS} selected={f.cdlRequired} onChange={f.setCdlRequired} testIdPrefix="checkbox-cdl" />
      </FilterSection>

      <FilterSection title="Work Environment">
        <CheckboxFilter items={WORK_ENVIRONMENTS} selected={f.workEnvironments} onChange={f.setWorkEnvironments} testIdPrefix="checkbox-work-env" />
      </FilterSection>

      <FilterSection title="Driver Type" defaultOpen={false}>
        <CheckboxFilter items={DRIVER_TYPES} selected={f.driverTypes} onChange={f.setDriverTypes} testIdPrefix="checkbox-driver-type" />
      </FilterSection>

      <FilterSection title="Salary Range">
        <div className="px-1 pt-1">
          <Slider
            min={0}
            max={SALARY_MAX}
            step={5000}
            value={f.salaryRange}
            onValueChange={(val) => f.setSalaryRange(val as [number, number])}
            data-testid="slider-salary-range"
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-salary-min">{formatSalary(f.salaryRange[0])}</span>
            <span data-testid="text-salary-max">{f.salaryRange[1] >= SALARY_MAX ? `${formatSalary(SALARY_MAX)}+` : formatSalary(f.salaryRange[1])}</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Date Posted">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-muted-foreground">Last 7 days</span>
          <Switch
            checked={f.recentOnly}
            onCheckedChange={f.setRecentOnly}
            data-testid="switch-recent-only"
          />
        </label>
      </FilterSection>
    </div>
  );
}

type JobFilterSidebarProps = {
  filters: JobFilters;
  filteredCount: number;
  industries?: Category[];
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function JobFilterSidebar({ filters, filteredCount, industries = [], mobileOpen, onMobileClose }: JobFilterSidebarProps) {
  const activeFilterCount = getActiveFilterCount(filters);
  const onClearAll = () => clearAllFilters(filters);

  const content = (
    <SidebarContent
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearAll={onClearAll}
      industries={industries}
    />
  );

  return (
    <>
      <aside className="hidden lg:block w-72 shrink-0" data-testid="sidebar-filters-desktop">
        <div className="sticky top-6 bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto">
          {content}
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
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
                <Button variant="ghost" size="sm" onClick={onMobileClose} data-testid="button-close-mobile-filters">
                  <X size={20} />
                </Button>
              </div>
              <div className="p-4">{content}</div>
              <div className="sticky bottom-0 p-4 bg-white dark:bg-slate-900 border-t border-border">
                <Button className="w-full" onClick={onMobileClose} data-testid="button-apply-mobile-filters">
                  Show {filteredCount} result{filteredCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MobileFilterButton({ filters, onClick }: { filters: JobFilters; onClick: () => void }) {
  const activeFilterCount = getActiveFilterCount(filters);
  return (
    <Button
      variant="outline"
      className="lg:hidden flex items-center gap-2"
      onClick={onClick}
      data-testid="button-mobile-filters"
    >
      <Filter size={16} />
      Filters
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{activeFilterCount}</Badge>
      )}
    </Button>
  );
}
