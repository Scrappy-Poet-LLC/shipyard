export type Environment = {
  id: string;
  name: string;
  slug: string;
  commit_ceiling: number;
};

export type GitHubInstallation = {
  id: string;
  installation_id: number;
  org_name: string;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  display_name: string;
  github_repo: string;
  default_branch: string;
  installation_id: string;
};

export type ServiceEnvironment = {
  id: string;
  service_id: string;
  environment_id: string;
  workflow_file: string;
};

export type ServiceWithEnvironment = Service & {
  service_environment_id: string;
  workflow_file: string;
};

export type SortOption = "deployed" | "alpha" | "staleness";

export type LayoutOption = "comfortable" | "compact";

export type DeploymentInfo = {
  service_id: string;
  display_name: string;
  github_repo: string;
  workflow_file: string;
  commit_sha: string | null;
  short_sha: string | null;
  commit_author: string | null;
  branch: string | null;
  deployed_at: string | null;
  commits_behind: number | null;
  staleness_score: number;
  compare_url: string | null;
  error: string | null;
};
