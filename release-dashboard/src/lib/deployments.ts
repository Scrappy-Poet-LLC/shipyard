import type { DeploymentInfo, SortOption } from "@/lib/types";

function searchMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query);
}

export function sortDeployments(
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

export function moveFailuresToBottom(
  deployments: DeploymentInfo[]
): DeploymentInfo[] {
  const healthy: DeploymentInfo[] = [];
  const failures: DeploymentInfo[] = [];

  for (const deployment of deployments) {
    if (deployment.error) {
      failures.push(deployment);
    } else {
      healthy.push(deployment);
    }
  }

  return [...healthy, ...failures];
}

/**
 * Returns service IDs that match the query (substring match on display_name or github_repo).
 * Returns null when query is empty (meaning "show all").
 */
export function getMatchedServiceIds(
  deployments: DeploymentInfo[],
  query: string
): Set<string> | null {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return null;

  const ids = new Set<string>();
  for (const d of deployments) {
    if (
      searchMatch(normalized, d.display_name) ||
      searchMatch(normalized, d.github_repo)
    ) {
      ids.add(d.service_id);
    }
  }
  return ids;
}
