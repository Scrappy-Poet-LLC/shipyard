"use client";

import { useState } from "react";
import type { DeploymentInfo } from "@/lib/types";
import { getStalenessColor } from "@/lib/colors";
import { timeAgo } from "@/lib/time";

type ServiceCardProps = {
  deployment: DeploymentInfo;
  environmentSlug: string;
};

export function ServiceCard({ deployment, environmentSlug }: ServiceCardProps) {
  const [data, setData] = useState(deployment);
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(
        `/api/deploy-status?service_id=${data.service_id}&environment=${environmentSlug}`
      );
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
      }
    } finally {
      setRetrying(false);
    }
  }

  if (data.error) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-400" />
        <div className="py-5 pl-6 pr-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {data.display_name}
              </h3>
              <p className="mt-1 text-xs text-gray-500 font-mono">
                {data.github_repo}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              Failed to load
            </span>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="text-xs font-medium text-red-600 underline hover:text-red-800 disabled:opacity-50"
            >
              {retrying ? "Retrying..." : "Retry"}
            </button>
          </div>
          <p className="mt-2 text-xs text-red-500 truncate">{data.error}</p>
        </div>
      </div>
    );
  }

  const color = getStalenessColor(data.staleness_score);
  const commitsBehind = data.commits_behind ?? 0;
  const isUpToDate = commitsBehind === 0;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md ${
        isUpToDate
          ? "border-amber-300/70 bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-white ring-1 ring-amber-200/50"
          : "border-gray-200 bg-white"
      }`}
      style={isUpToDate ? { boxShadow: "0 0 12px rgba(251, 191, 36, 0.15)" } : undefined}
    >
      <div
        className={`absolute inset-y-0 left-0 ${isUpToDate ? "w-2" : "w-1.5"}`}
        style={{
          backgroundColor: isUpToDate ? undefined : color,
          background: isUpToDate
            ? "linear-gradient(to bottom, #f59e0b, #fbbf24, #f59e0b)"
            : undefined,
        }}
      />
      <div className="py-5 pl-6 pr-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {data.display_name}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 font-mono truncate">
              {data.github_repo}
            </p>
          </div>
          {isUpToDate ? (
            <div className="ml-3 flex-shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm">
              Up to date
            </div>
          ) : (
            <div
              className="ml-3 flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {commitsBehind} behind
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Commit
            </p>
            <p className="mt-1 text-sm font-mono text-gray-800">
              {data.short_sha ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Author
            </p>
            <p className="mt-1 text-sm text-gray-800 truncate">
              {data.commit_author ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Deployed
            </p>
            <p className="mt-1 text-sm text-gray-800">
              {data.deployed_at ? timeAgo(data.deployed_at) : "—"}
            </p>
          </div>
        </div>

        {data.branch && (
          <div className="mt-3">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
              {data.branch}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
