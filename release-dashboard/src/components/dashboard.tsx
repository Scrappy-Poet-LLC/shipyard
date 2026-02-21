"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DeploymentInfo, Environment, SortOption } from "@/lib/types";
import { ServiceCard } from "./service-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DashboardProps = {
  deployments: DeploymentInfo[];
  environments: Environment[];
  currentEnvironment: string;
  currentSort: SortOption;
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "deployed", label: "Last Deployed" },
  { value: "alpha", label: "Alphabetical" },
  { value: "staleness", label: "Staleness" },
];

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
  deployments,
  environments,
  currentEnvironment,
  currentSort,
}: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function handleEnvironmentChange(slug: string) {
    document.cookie = `env=${slug};path=/;max-age=31536000`;
    updateParams({ env: slug });
  }

  function handleSortChange(sort: SortOption) {
    document.cookie = `sort=${sort};path=/;max-age=31536000`;
    updateParams({ sort });
  }

  const sortedDeployments = useMemo(
    () => sortDeployments(deployments, currentSort),
    [deployments, currentSort]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              Release Dashboard
            </h1>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  const supabase = createSupabaseBrowserClient();
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-700"
              >
                Sign out
              </button>

              <div className="h-5 w-px bg-gray-300" />

              <div className="flex items-center gap-2">
                <label
                  htmlFor="env-select"
                  className="text-sm font-medium text-gray-500"
                >
                  Environment
                </label>
                <select
                  id="env-select"
                  value={currentEnvironment}
                  onChange={(e) => handleEnvironmentChange(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                >
                  {environments.map((env) => (
                    <option key={env.slug} value={env.slug}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-5 w-px bg-gray-300" />

              <div className="flex items-center gap-2">
                <label
                  htmlFor="sort-select"
                  className="text-sm font-medium text-gray-500"
                >
                  Sort
                </label>
                <select
                  id="sort-select"
                  value={currentSort}
                  onChange={(e) =>
                    handleSortChange(e.target.value as SortOption)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {sortedDeployments.length === 0 ? (
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
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            {sortedDeployments.map((deployment) => (
              <ServiceCard
                key={deployment.service_id}
                deployment={deployment}
                environmentSlug={currentEnvironment}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
