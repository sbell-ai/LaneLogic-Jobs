import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { GraduationCap, Truck, Building2, ArrowRight } from "lucide-react";

const guides = [
  {
    slug: "job-seeker",
    title: "Job Seeker Guide",
    description: "Everything you need to find and apply for transportation jobs — from setting up your profile and uploading your resume to tracking applications and messaging employers.",
    icon: Truck,
    color: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/60",
  },
  {
    slug: "employer",
    title: "Employer Guide",
    description: "Learn how to post jobs, review applicants, manage your hiring pipeline, send messages, and get the most out of your LaneLogic Jobs employer account.",
    icon: Building2,
    color: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60",
  },
];

export default function GuidesIndex() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/5 to-transparent py-14 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <GraduationCap size={24} className="text-primary" />
            </div>
            <h1 className="text-4xl font-bold font-display text-foreground mb-3">User Guides</h1>
            <p className="text-lg text-muted-foreground">
              Step-by-step help for getting the most out of LaneLogic Jobs — whether you're looking for work or hiring.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="grid gap-5 sm:grid-cols-2">
            {guides.map((guide) => {
              const Icon = guide.icon;
              return (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  data-testid={`link-guide-${guide.slug}`}
                  className={`group flex flex-col rounded-2xl border p-6 hover:shadow-md transition-all duration-200 ${guide.color}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${guide.iconBg}`}>
                    <Icon size={22} className={guide.iconColor} />
                  </div>
                  <h2 className="text-xl font-bold font-display text-foreground mb-2 group-hover:text-primary transition-colors">
                    {guide.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {guide.description}
                  </p>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
                    Read guide <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
