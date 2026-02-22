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
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-red-400" />
        <div className="py-4 pl-5 pr-4 sm:py-5 sm:pl-6 sm:pr-5">
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

  const CardWrapper = data.compare_url ? "a" : "div";
  const linkProps = data.compare_url
    ? { href: data.compare_url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <CardWrapper
      {...linkProps}
      className={`group relative block min-w-0 overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md ${
        isUpToDate
          ? "border-blue-300/70 bg-gradient-to-br from-blue-50/80 via-sky-50/50 to-white ring-1 ring-blue-200/50"
          : "border-gray-200 bg-white"
      } ${data.compare_url ? "cursor-pointer" : ""}`}
      style={isUpToDate ? { boxShadow: "0 0 12px rgba(59, 130, 246, 0.12)" } : undefined}
    >
      <div
        className={`absolute inset-y-0 left-0 ${isUpToDate ? "w-2" : "w-1.5"}`}
        style={{
          backgroundColor: isUpToDate ? undefined : color,
          background: isUpToDate
            ? "linear-gradient(to bottom, #3b82f6, #60a5fa, #3b82f6)"
            : undefined,
        }}
      />
      <div className="py-4 pl-5 pr-4 sm:py-5 sm:pl-6 sm:pr-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {data.display_name}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 font-mono truncate">
              {data.github_repo}
            </p>
          </div>
          {isUpToDate ? (
            <div className="ml-3 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-sky-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
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

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
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

        <div className="mt-3 flex items-center justify-between">
          {data.branch ? (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
              {data.branch}
            </span>
          ) : (
            <span />
          )}
          {data.compare_url && (
            <span className="text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
              View on GitHub &rarr;
            </span>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}
