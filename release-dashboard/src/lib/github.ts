import { App, Octokit } from "octokit";
import type { ServiceWithEnvironment, DeploymentInfo } from "./types";
import { getStalenessScore } from "./colors";

let appInstance: App | null = null;

function getApp(): App {
  if (!appInstance) {
    appInstance = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET! },
    });
  }
  return appInstance;
}

export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  const app = getApp();
  return app.getInstallationOctokit(installationId);
}

export function getAppWebhooks() {
  return getApp().webhooks;
}

export async function listInstallationRepos(octokit: Octokit) {
  const repos: Array<{
    full_name: string;
    name: string;
    default_branch: string;
  }> = [];

  const iterator =
    octokit.paginate.iterator(
      "GET /installation/repositories",
      { per_page: 100 }
    );

  for await (const response of iterator) {
    for (const repo of response.data) {
      const r = repo as { full_name: string; name: string; default_branch: string };
      repos.push({
        full_name: r.full_name,
        name: r.name,
        default_branch: r.default_branch,
      });
    }
  }

  return repos;
}

export async function listRepoWorkflows(
  octokit: Octokit,
  owner: string,
  repo: string
) {
  const { data } = await octokit.rest.actions.listRepoWorkflows({
    owner,
    repo,
    per_page: 100,
  });
  return data.workflows;
}

const ENV_PATTERNS: Record<string, string[]> = {
  production: ["prod"],
  staging: ["stage"],
  sandbox: ["sandbox"],
};

export function detectEnvironmentForWorkflow(
  workflowPath: string
): string | null {
  const lower = workflowPath.toLowerCase();
  for (const [envSlug, patterns] of Object.entries(ENV_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      return envSlug;
    }
  }
  return null;
}

export async function fetchDeploymentInfo(
  octokit: Octokit,
  service: ServiceWithEnvironment,
  commitCeiling: number
): Promise<DeploymentInfo> {
  const [owner, repo] = service.github_repo.split("/");

  const baseResult: DeploymentInfo = {
    service_id: service.id,
    display_name: service.display_name,
    github_repo: service.github_repo,
    workflow_file: service.workflow_file,
    commit_sha: null,
    short_sha: null,
    commit_author: null,
    branch: null,
    deployed_at: null,
    commits_behind: null,
    commits_ahead: null,
    staleness_score: 0,
    compare_url: null,
    ahead_compare_url: null,
    error: null,
  };

  try {
    const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: service.workflow_file,
      status: "success",
      per_page: 1,
    });

    if (runs.workflow_runs.length === 0) {
      return { ...baseResult, error: "No successful workflow runs found" };
    }

    const latestRun = runs.workflow_runs[0];
    const deployedSha = latestRun.head_sha;

    const { data: commitData } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: deployedSha,
    });

    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: deployedSha,
      head: service.default_branch,
    });

    const commitsBehind = comparison.ahead_by;
    const commitsAhead = comparison.behind_by;
    const compareUrl = `https://github.com/${owner}/${repo}/compare/${deployedSha}...${service.default_branch}`;
    const aheadCompareUrl = commitsAhead > 0
      ? `https://github.com/${owner}/${repo}/compare/${service.default_branch}...${deployedSha}`
      : null;

    return {
      ...baseResult,
      commit_sha: deployedSha,
      short_sha: deployedSha.substring(0, 7),
      commit_author:
        commitData.commit.author?.name ??
        commitData.author?.login ??
        "Unknown",
      branch: latestRun.head_branch ?? null,
      deployed_at: latestRun.updated_at,
      commits_behind: commitsBehind,
      commits_ahead: commitsAhead,
      staleness_score: getStalenessScore(commitsBehind, commitCeiling),
      compare_url: compareUrl,
      ahead_compare_url: aheadCompareUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ...baseResult, error: message };
  }
}
