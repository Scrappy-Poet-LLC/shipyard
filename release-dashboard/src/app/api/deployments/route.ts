import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstallationOctokit, fetchDeploymentInfo } from "@/lib/github";
import type { DeploymentInfo, ServiceWithEnvironment } from "@/lib/types";

type ServiceRow = {
  id: string;
  workflow_file: string;
  service: {
    id: string;
    display_name: string;
    github_repo: string;
    default_branch: string;
    installation_id: string;
    installation: {
      installation_id: number;
    };
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const environmentSlug = searchParams.get("env");

  if (!environmentSlug) {
    return NextResponse.json({ error: "Missing env parameter" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: selectedEnv } = await supabase
    .from("environments")
    .select("commit_ceiling")
    .eq("slug", environmentSlug)
    .single();

  const commitCeiling = selectedEnv?.commit_ceiling ?? 30;

  const { data } = await supabase
    .from("service_environments")
    .select(
      `
      id,
      workflow_file,
      service:services!inner(
        id, display_name, github_repo, default_branch, installation_id,
        installation:github_installations!inner(installation_id)
      ),
      environment:environments!inner(slug)
    `
    )
    .eq("environments.slug", environmentSlug);

  if (!data || data.length === 0) {
    return NextResponse.json([]);
  }

  const rows = data as unknown as ServiceRow[];
  let installationId: number | null = null;

  const services: ServiceWithEnvironment[] = rows.map((row) => {
    if (installationId === null) {
      installationId = row.service.installation.installation_id;
    }
    return {
      id: row.service.id,
      display_name: row.service.display_name,
      github_repo: row.service.github_repo,
      default_branch: row.service.default_branch,
      installation_id: row.service.installation_id,
      service_environment_id: row.id,
      workflow_file: row.workflow_file,
    };
  });

  if (installationId === null) {
    return NextResponse.json([]);
  }

  const octokit = await getInstallationOctokit(installationId);

  const results = await Promise.allSettled(
    services.map((service) =>
      fetchDeploymentInfo(octokit, service, commitCeiling)
    )
  );

  const deployments: DeploymentInfo[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      service_id: services[index].id,
      display_name: services[index].display_name,
      github_repo: services[index].github_repo,
      workflow_file: services[index].workflow_file,
      commit_sha: null,
      short_sha: null,
      commit_author: null,
      branch: null,
      deployed_at: null,
      commits_behind: null,
      staleness_score: 0,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Failed to fetch deployment info",
    };
  });

  return NextResponse.json(deployments);
}
