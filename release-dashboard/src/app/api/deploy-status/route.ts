import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstallationOctokit, fetchDeploymentInfo } from "@/lib/github";
import type { ServiceWithEnvironment } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const environmentSlug = searchParams.get("environment");

  if (!serviceId || !environmentSlug) {
    return NextResponse.json(
      { error: "Missing service_id or environment" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows } = await supabase
    .from("service_environments")
    .select(
      `
      id,
      workflow_file,
      environment:environments!inner(id, slug, commit_ceiling),
      service:services!inner(id, display_name, github_repo, default_branch, installation_id,
        installation:github_installations!inner(installation_id)
      )
    `
    )
    .eq("service_id", serviceId)
    .eq("environments.slug", environmentSlug)
    .single();

  if (!rows) {
    return NextResponse.json(
      { error: "Service not found for this environment" },
      { status: 404 }
    );
  }

  const row = rows as Record<string, unknown>;
  const svc = row.service as Record<string, unknown>;
  const env = row.environment as Record<string, unknown>;
  const inst = svc.installation as Record<string, unknown>;

  const service: ServiceWithEnvironment = {
    id: svc.id as string,
    display_name: svc.display_name as string,
    github_repo: svc.github_repo as string,
    default_branch: svc.default_branch as string,
    installation_id: svc.installation_id as string,
    service_environment_id: row.id as string,
    workflow_file: row.workflow_file as string,
  };

  const installationId = inst.installation_id as number;
  const commitCeiling = env.commit_ceiling as number;

  const octokit = await getInstallationOctokit(installationId);
  const deployment = await fetchDeploymentInfo(octokit, service, commitCeiling);

  return NextResponse.json(deployment);
}
