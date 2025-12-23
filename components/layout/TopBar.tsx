"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

interface UserProfile {
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
    phoneNumber: string | null;
    role: string;
  };
  company: {
    id: string;
    name: string;
    logo: string | null;
    websiteUrl: string | null;
  } | null;
}

export default function TopBar({
  isMenuOpen,
  onMenuClick,
}: {
  isMenuOpen?: boolean;
  onMenuClick?: () => void;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchProfile();
    }
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  const userImage = profile?.user.imageUrl || null;
  const userName = profile?.user.name || session?.user?.name || "User";

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-black/60 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          aria-label={isMenuOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isMenuOpen ? (
            <X className="w-5 h-5 text-white/80" />
          ) : (
            <Menu className="w-5 h-5 text-white/80" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-[#e3ca76]" />
            ) : (
              <Moon className="w-5 h-5 text-[#a78443]" />
            )}
          </button>
        )}

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e3ca76] to-[#a78443] flex items-center justify-center">
                <User className="w-4 h-4 text-black" />
              </div>
            )}
            <ChevronDown
              className={`w-4 h-4 text-white/70 transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg bg-black/95 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-white/60 truncate">
                  {profile?.user.email || session?.user?.email}
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push("/dashboard/settings");
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
