"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Settings,
  UsersRound,
  BarChart3,
  UserCircle,
  Building2,
  UserCog,
  Users2,
  BookOpen,
} from "lucide-react";

interface CompanyInfo {
  id: string;
  name: string;
  logo: string | null;
  websiteUrl: string | null;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompany() {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setCompany(data.company);
          setUserRole(data.user.role);
        }
      } catch (error) {
        console.error("Failed to fetch company:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCompany();
  }, []);

  const allNavItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Company Members", icon: UserCog, path: "/dashboard/members" },
    { label: "Teams", icon: Users2, path: "/dashboard/teams" },
    { label: "Curriculums", icon: BookOpen, path: "/dashboard/curriculums" },
    {
      label: "AI Stats Dashboard",
      icon: BarChart3,
      path: "/dashboard/ai-stats",
    },
    {
      label: "Players",
      icon: UserCircle,
      path: "/dashboard/players",
    },
    { label: "Settings", icon: Settings, path: "/dashboard/settings" },
  ];

  // Filter nav items based on role
  const navItems = allNavItems.filter((item) => {
    if (item.path === "/dashboard/members") {
      return userRole === "owner" || userRole === "admin";
    }
    if (item.path === "/dashboard/teams") {
      // Players cannot access teams
      return userRole !== "player";
    }
    if (item.path === "/dashboard/curriculums") {
      // Coaches and players cannot access curriculums
      return userRole !== "coach" && userRole !== "player";
    }
    if (item.path === "/dashboard/ai-stats") {
      // Players cannot access AI stats dashboard
      return userRole !== "player";
    }
    return true;
  });

  return (
    <div className="fixed left-0 top-16 bottom-0 w-64 bg-black/60 backdrop-blur-md border-r border-white/10 z-40 flex flex-col">
      {/* Company Logo & Name */}
      <div className="p-4 border-b border-white/10">
        {loading ? (
          <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
            {company?.logo ? (
              <img
                src={company.logo}
                alt={company.name || "Company"}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#e3ca76] to-[#a78443] flex items-center justify-center flex-shrink-0 border border-white/10">
                <Building2 className="w-6 h-6 text-black" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {company?.name || "Company"}
              </p>
              {company?.websiteUrl && (
                <p className="text-xs text-white/50 truncate">
                  {company.websiteUrl.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#e3ca76]/20 text-[#e3ca76] border border-[#e3ca76]/30"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

