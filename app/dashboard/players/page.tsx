"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Grid3x3,
  List,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Footprints,
  Calendar,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface Player {
  id: string;
  parentUserId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dob: string | null;
  age: number | null;
  ageGroup: string | null;
  gender: string | null;
  dominantFoot: string | null;
  notes: string | null;
  selfSupervised?: boolean;
  email: string;
  emailVerified: boolean;
  onboarded: boolean;
  imageUrl: string | null;
  teamName: string;
  coachId: string | null;
  coachName: string | null;
  coachEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "table" | "grid";
type SortField =
  | "name"
  | "team"
  | "coach"
  | "age"
  | "ageGroup"
  | "gender"
  | "dominantFoot";
type SortDirection = "asc" | "desc";

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedCoach, setSelectedCoach] = useState<string>("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedFoot, setSelectedFoot] = useState<string>("");

  // Sort states
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    try {
      setLoading(true);
      const response = await fetch("/api/players");
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players);
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  }

  // Get unique values for filters
  const teams = useMemo(() => {
    const uniqueTeams = Array.from(
      new Set(players.map((p) => p.teamName))
    ).sort();
    return uniqueTeams;
  }, [players]);

  const coaches = useMemo(() => {
    const uniqueCoaches = Array.from(
      new Set(
        players
          .map((p) => (p.coachName ? `${p.coachName}|${p.coachId}` : null))
          .filter((c): c is string => c !== null)
      )
    )
      .map((c) => {
        const [name, id] = c.split("|");
        return { name, id };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return uniqueCoaches;
  }, [players]);

  const ageGroups = useMemo(() => {
    const uniqueAgeGroups = Array.from(
      new Set(players.map((p) => p.ageGroup).filter((ag): ag is string => ag !== null))
    ).sort();
    return uniqueAgeGroups;
  }, [players]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = [...players];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          p.fullName.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query)
      );
    }

    // Apply team filter
    if (selectedTeam) {
      filtered = filtered.filter((p) => p.teamName === selectedTeam);
    }

    // Apply coach filter
    if (selectedCoach) {
      filtered = filtered.filter((p) => p.coachId === selectedCoach);
    }

    // Apply age group filter
    if (selectedAgeGroup) {
      filtered = filtered.filter((p) => p.ageGroup === selectedAgeGroup);
    }

    // Apply gender filter
    if (selectedGender) {
      filtered = filtered.filter((p) => p.gender === selectedGender);
    }

    // Apply dominant foot filter
    if (selectedFoot) {
      filtered = filtered.filter((p) => p.dominantFoot === selectedFoot);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = `${a.lastName} ${a.firstName}`.toLowerCase();
          bValue = `${b.lastName} ${b.firstName}`.toLowerCase();
          break;
        case "team":
          aValue = a.teamName.toLowerCase();
          bValue = b.teamName.toLowerCase();
          break;
        case "coach":
          aValue = (a.coachName || "").toLowerCase();
          bValue = (b.coachName || "").toLowerCase();
          break;
        case "age":
          aValue = a.age ?? 0;
          bValue = b.age ?? 0;
          break;
        case "ageGroup":
          aValue = a.ageGroup || "";
          bValue = b.ageGroup || "";
          break;
        case "gender":
          aValue = a.gender || "";
          bValue = b.gender || "";
          break;
        case "dominantFoot":
          aValue = a.dominantFoot || "";
          bValue = b.dominantFoot || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    players,
    searchQuery,
    selectedTeam,
    selectedCoach,
    selectedAgeGroup,
    selectedGender,
    selectedFoot,
    sortField,
    sortDirection,
  ]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setSelectedTeam("");
    setSelectedCoach("");
    setSelectedAgeGroup("");
    setSelectedGender("");
    setSelectedFoot("");
  }

  const hasActiveFilters =
    searchQuery ||
    selectedTeam ||
    selectedCoach ||
    selectedAgeGroup ||
    selectedGender ||
    selectedFoot;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Players</h1>
          <p className="text-white/70 mt-1">
            View and manage all players across your teams
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "primary" : "outline"}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 bg-[#e3ca76] text-black text-xs rounded-full">
                {[
                  searchQuery,
                  selectedTeam,
                  selectedCoach,
                  selectedAgeGroup,
                  selectedGender,
                  selectedFoot,
                ].filter(Boolean).length}
              </span>
            )}
          </Button>
          <div className="flex items-center gap-1 border border-white/10 rounded-lg p-1 bg-white/5">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded transition-colors ${
                viewMode === "table"
                  ? "bg-[#e3ca76]/20 text-[#e3ca76]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded transition-colors ${
                viewMode === "grid"
                  ? "bg-[#e3ca76]/20 text-[#e3ca76]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#e3ca76]/50"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Filters</h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-white/70 hover:text-white flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Team Filter */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Team
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              >
                <option value="">All Teams</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>

            {/* Coach Filter */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Coach
              </label>
              <select
                value={selectedCoach}
                onChange={(e) => setSelectedCoach(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              >
                <option value="">All Coaches</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Age Group Filter */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Age Group
              </label>
              <select
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              >
                <option value="">All Age Groups</option>
                {ageGroups.map((ageGroup) => (
                  <option key={ageGroup} value={ageGroup}>
                    {ageGroup}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Gender
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Dominant Foot Filter */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Dominant Foot
              </label>
              <select
                value={selectedFoot}
                onChange={(e) => setSelectedFoot(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              >
                <option value="">All</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4 text-white/70 text-sm">
        Showing {filteredAndSortedPlayers.length} of {players.length} players
      </div>

      {/* Players List */}
      {filteredAndSortedPlayers.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/60 p-12 text-center">
          <User className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/70 text-lg mb-2">No players found</p>
          <p className="text-white/50 text-sm">
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "No players have been added yet"}
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Name
                      {sortField === "name" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("team")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Team
                      {sortField === "team" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("coach")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Coach
                      {sortField === "coach" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("age")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Age
                      {sortField === "age" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("ageGroup")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Age Group
                      {sortField === "ageGroup" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("gender")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Gender
                      {sortField === "gender" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("dominantFoot")}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                    >
                      Foot
                      {sortField === "dominantFoot" && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedPlayers.map((player, index) => (
                  <tr
                    key={player.id}
                    onClick={() =>
                      router.push(
                        `/dashboard/teams/${player.teamId}/player/${player.id}`
                      )
                    }
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                      index % 2 === 0 ? "bg-white/2" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-white font-medium">
                          {player.fullName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.teamName}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.coachName || "—"}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.age !== null ? `${player.age}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.ageGroup || "—"}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.gender || "—"}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {player.dominantFoot ? (
                        <span className="flex items-center gap-1">
                          <Footprints className="w-4 h-4" />
                          {player.dominantFoot.charAt(0).toUpperCase() +
                            player.dominantFoot.slice(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {player.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedPlayers.map((player) => (
            <div
              key={player.id}
              onClick={() =>
                router.push(
                  `/dashboard/teams/${player.teamId}/player/${player.id}`
                )
              }
              className="rounded-2xl border border-white/10 bg-black/60 p-6 hover:border-white/20 transition-colors cursor-pointer"
            >
              <div className="mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">
                    {player.fullName}
                  </h3>
                  <p className="text-white/70 text-sm truncate">
                    {player.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="truncate">{player.teamName}</span>
                </div>

                {player.coachName && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <User className="w-4 h-4" />
                    <span className="truncate">{player.coachName}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-white/70 text-sm pt-2 border-t border-white/10">
                  {player.age !== null && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{player.age} years</span>
                    </div>
                  )}
                  {player.dominantFoot && (
                    <div className="flex items-center gap-1">
                      <Footprints className="w-4 h-4" />
                      <span>
                        {player.dominantFoot.charAt(0).toUpperCase() +
                          player.dominantFoot.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                {player.ageGroup && (
                  <div className="text-white/50 text-xs pt-1">
                    {player.ageGroup}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

