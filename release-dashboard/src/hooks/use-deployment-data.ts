"use client";

import { useCallback, useRef, useState } from "react";
import type { DeploymentInfo } from "@/lib/types";

async function fetchDeployments(slug: string): Promise<DeploymentInfo[]> {
  const res = await fetch(`/api/deployments?env=${slug}`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Manages deployment data with per-environment caching and refresh.
 */
export function useDeploymentData(
  initialDeployments: DeploymentInfo[],
  currentEnvironment: string
) {
  const cache = useRef<Map<string, DeploymentInfo[]>>(
    new Map([[currentEnvironment, initialDeployments]])
  );
  const fetchedAt = useRef<Map<string, Date>>(
    new Map([[currentEnvironment, new Date()]])
  );

  const [deployments, setDeployments] = useState(initialDeployments);
  const [activeEnv, setActiveEnv] = useState(currentEnvironment);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date>(new Date());

  const handleEnvironmentChange = useCallback(
    async (slug: string, onUrlUpdate: (updates: Record<string, string>) => void) => {
      setActiveEnv(slug);
      document.cookie = `env=${slug};path=/;max-age=31536000`;
      onUrlUpdate({ env: slug });

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
    },
    []
  );

  const handleRefresh = useCallback(async () => {
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
  }, [activeEnv]);

  return {
    deployments,
    activeEnv,
    loading,
    lastFetched,
    handleEnvironmentChange,
    handleRefresh,
  };
}
