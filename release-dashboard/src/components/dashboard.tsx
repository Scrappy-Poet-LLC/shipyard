"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeploymentInfo, Environment, LayoutOption, SortOption } from "@/lib/types";
import { ServiceCard } from "./service-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { timeAgo } from "@/lib/time";

type DashboardProps = {
  deployments: DeploymentInfo[];
  environments: Environment[];
  currentEnvironment: string;
  currentSort: SortOption;
  currentLayout: LayoutOption;
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "deployed", label: "Last Deployed" },
  { value: "alpha", label: "Alphabetical" },
  { value: "staleness", label: "Staleness" },
];

function searchMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query);
}

function sortDeployments(
  deployments: DeploymentInfo[],
  sort: SortOption
): DeploymentInfo[] {
  const sorted = [...deployments];

  switch (sort) {
    case "deployed":
      sorted.sort((a, b) => {
        if (!a.deployed_at && !b.deployed_at) return 0;
        if (!a.deployed_at) return 1;
        if (!b.deployed_at) return -1;
        return (
          new Date(b.deployed_at).getTime() -
          new Date(a.deployed_at).getTime()
        );
      });
      break;
    case "alpha":
      sorted.sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      );
      break;
    case "staleness":
      sorted.sort(
        (a, b) => (b.commits_behind ?? 0) - (a.commits_behind ?? 0)
      );
      break;
  }

  return sorted;
}

export function Dashboard({
  deployments: initialDeployments,
  environments,
  currentEnvironment,
  currentSort,
  currentLayout,
}: DashboardProps) {
  const cache = useRef<Map<string, DeploymentInfo[]>>(
    new Map([[currentEnvironment, initialDeployments]])
  );
  const fetchedAt = useRef<Map<string, Date>>(
    new Map([[currentEnvironment, new Date()]])
  );
  const [deployments, setDeployments] = useState(initialDeployments);
  const [activeEnv, setActiveEnv] = useState(currentEnvironment);
  const [activeSort, setActiveSort] = useState<SortOption>(currentSort);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>(currentLayout);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname, searchParams]
  );

  async function fetchDeployments(slug: string): Promise<DeploymentInfo[]> {
    const res = await fetch(`/api/deployments?env=${slug}`);
    if (!res.ok) return [];
    return res.json();
  }

  async function handleEnvironmentChange(slug: string) {
    setActiveEnv(slug);
    document.cookie = `env=${slug};path=/;max-age=31536000`;
    updateUrl({ env: slug });

    const cached = cache.current.get(slug);
    if (cached) {
      setDeployments(cached);
      setLastFetched(fetchedAt.current.get(slug) ?? new Date());
      return;
    }

    setLoading(true);
    try {
      const data = await fetchDeployments(slug);
      const now = new Date();
      cache.current.set(slug, data);
      fetchedAt.current.set(slug, now);
      setDeployments(data);
      setLastFetched(now);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      const data = await fetchDeployments(activeEnv);
      const now = new Date();
      cache.current.set(activeEnv, data);
      fetchedAt.current.set(activeEnv, now);
      setDeployments(data);
      setLastFetched(now);
    } finally {
      setLoading(false);
    }
  }

  function handleSortChange(sort: SortOption) {
    setActiveSort(sort);
    document.cookie = `sort=${sort};path=/;max-age=31536000`;
    updateUrl({ sort });
  }

  function handleLayoutChange(layout: LayoutOption) {
    setActiveLayout(layout);
    document.cookie = `layout=${layout};path=/;max-age=31536000`;
    updateUrl({ layout });
  }

  const sortedDeployments = useMemo(
    () => sortDeployments(deployments, activeSort),
    [deployments, activeSort]
  );

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const matchedIds = useMemo(() => {
    if (!normalizedQuery) return null;
    const ids = new Set<string>();
    for (const d of sortedDeployments) {
      if (
        searchMatch(normalizedQuery, d.display_name) ||
        searchMatch(normalizedQuery, d.github_repo)
      ) {
        ids.add(d.service_id);
      }
    }
    return ids;
  }, [sortedDeployments, normalizedQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap sm:text-xl">
                Release Dashboard
              </h1>
              <button
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh deployment data"
                className="flex-shrink-0 rounded-lg border border-gray-300 bg-white p-1.5 text-gray-400 shadow-sm transition hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <span className="hidden text-xs text-gray-400 whitespace-nowrap sm:inline">
                Fetched {timeAgo(lastFetched.toISOString())}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:hidden">
              <button
                onClick={() => handleLayoutChange("comfortable")}
                title="Comfortable (2 columns)"
                className={`rounded-md p-1.5 transition ${activeLayout === "comfortable" ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v14H4zM14 5h6v14h-6z" />
                </svg>
              </button>
              <button
                onClick={() => handleLayoutChange("compact")}
                title="Compact (3 columns)"
                className={`rounded-md p-1.5 transition ${activeLayout === "compact" ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative flex-grow sm:flex-grow-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      searchInputRef.current?.blur();
                    }
                  }}
                  placeholder="Find service..."
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 sm:w-40"
              />
            </div>

            <select
              id="env-select"
              value={activeEnv}
              onChange={(e) => handleEnvironmentChange(e.target.value)}
              disabled={loading}
              aria-label="Environment"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50"
            >
              {environments.map((env) => (
                <option key={env.slug} value={env.slug}>
                  {env.name}
                </option>
              ))}
            </select>

            <select
              id="sort-select"
              value={activeSort}
              onChange={(e) =>
                handleSortChange(e.target.value as SortOption)
              }
              aria-label="Sort"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="hidden items-center gap-1 sm:flex">
              <button
                onClick={() => handleLayoutChange("comfortable")}
                title="Comfortable (2 columns)"
                className={`rounded-md p-1.5 transition ${activeLayout === "comfortable" ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v14H4zM14 5h6v14h-6z" />
                </svg>
              </button>
              <button
                onClick={() => handleLayoutChange("compact")}
                title="Compact (3 columns)"
                className={`rounded-md p-1.5 transition ${activeLayout === "compact" ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className={`grid gap-4 sm:grid-cols-1 ${activeLayout === "compact" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {Array.from({ length: Math.max(sortedDeployments.length, 4) }).map((_, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="absolute inset-y-0 left-0 w-1.5 animate-pulse bg-gray-200" />
                <div className="py-5 pl-6 pr-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
                    </div>
                    <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                      <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                      <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedDeployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl text-gray-300 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-600">
              No services found
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              No services are configured for this environment.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 sm:grid-cols-1 ${activeLayout === "compact" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {sortedDeployments.map((deployment) => {
              const isMatch = matchedIds === null || matchedIds.has(deployment.service_id);
              const hasQuery = matchedIds !== null;
              return (
                <div
                  key={`${activeEnv}-${deployment.service_id}`}
                  className="min-w-0 overflow-hidden transition-all duration-200"
                  style={{
                    transform: hasQuery && isMatch ? "scale(1.02)" : undefined,
                    opacity: hasQuery && !isMatch ? 0.35 : 1,
                  }}
                >
                  <ServiceCard
                    deployment={deployment}
                    environmentSlug={activeEnv}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <button
          onClick={async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="text-xs text-gray-400 transition hover:text-gray-600"
        >
          Sign out
        </button>
      </footer>
    </div>
  );
}
