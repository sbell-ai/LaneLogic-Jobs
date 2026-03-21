import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/pages/dashboard/DashboardLayout";
import IdentitySection from "./IdentitySection";
import SecuritySection from "./SecuritySection";
import PermissionsSection from "./PermissionsSection";
import NotificationsSection from "./NotificationsSection";
import SystemStatusSection from "./SystemStatusSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { User, ShieldCheck, Lock, Bell, Activity } from "lucide-react";

const SECTIONS = [
  { id: "identity", label: "Account Identity", icon: User },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "permissions", label: "Permissions & Access", icon: Lock },
  { id: "notifications", label: "Notification Preferences", icon: Bell },
  { id: "status", label: "System Status", icon: Activity },
];

export default function AdminProfile() {
  const [activeSection, setActiveSection] = useState("identity");
  const [profileData, setProfileData] = useState<any>(null);

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/profile"],
  });

  useEffect(() => {
    if (profile && !profileData) setProfileData(profile);
  }, [profile]);

  const displayProfile = profileData ?? profile;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Admin Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account, security, and platform preferences.</p>
        </div>

        <div className="flex gap-2 flex-wrap border-b pb-0">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
                data-testid={`tab-${section.id}`}
              >
                <Icon size={15} />
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {isLoading && !displayProfile ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : (
            <>
              {activeSection === "identity" && displayProfile && (
                <IdentitySection profile={displayProfile} onUpdate={setProfileData} />
              )}
              {activeSection === "security" && <SecuritySection />}
              {activeSection === "permissions" && <PermissionsSection />}
              {activeSection === "notifications" && <NotificationsSection />}
              {activeSection === "status" && <SystemStatusSection />}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
