import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getInstallationOctokit,
  listInstallationRepos,
  listRepoWorkflows,
  detectEnvironmentForWorkflow,
} from "@/lib/github";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  if (!installationId) {
    return NextResponse.json(
      { error: "Missing installation_id" },
      { status: 400 }
    );
  }

  const numericInstallationId = parseInt(installationId, 10);
  const supabase = createSupabaseAdminClient();

  try {
    const octokit = await getInstallationOctokit(numericInstallationId);

    const appResponse = await octokit.rest.apps.getAuthenticated();
    const appOwner = appResponse.data?.owner as { login?: string } | undefined;
    const orgName =
      appOwner?.login ?? `installation-${numericInstallationId}`;

    const { error: installError } = await supabase
      .from("github_installations")
      .upsert(
        {
          installation_id: numericInstallationId,
          org_name: orgName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" }
      );

    if (installError) throw installError;

    const { data: installation } = await supabase
      .from("github_installations")
      .select("id")
      .eq("installation_id", numericInstallationId)
      .single();

    if (!installation) throw new Error("Failed to retrieve installation");

    const { data: environments } = await supabase
      .from("environments")
      .select("id, slug");

    if (!environments) throw new Error("No environments configured");

    const envBySlug = new Map(environments.map((e) => [e.slug, e.id]));
    const repos = await listInstallationRepos(octokit);

    for (const repo of repos) {
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .upsert(
          {
            display_name: repo.name,
            github_repo: repo.full_name,
            default_branch: repo.default_branch,
            installation_id: installation.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "github_repo" }
        )
        .select("id")
        .single();

      if (serviceError || !service) continue;

      const [owner, repoName] = repo.full_name.split("/");
      try {
        const workflows = await listRepoWorkflows(octokit, owner, repoName);

        for (const workflow of workflows) {
          const envSlug = detectEnvironmentForWorkflow(workflow.path);
          if (!envSlug) continue;

          const environmentId = envBySlug.get(envSlug);
          if (!environmentId) continue;

          const workflowFile = workflow.path.split("/").pop() ?? workflow.path;

          await supabase.from("service_environments").upsert(
            {
              service_id: service.id,
              environment_id: environmentId,
              workflow_file: workflowFile,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "service_id,environment_id" }
          );
        }
      } catch {
        // Skip repos where we can't list workflows
      }
    }

    if (setupAction === "install") {
      const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";
      const host = request.headers.get("host") ?? "localhost:3000";
      return NextResponse.redirect(new URL("/", `${forwardedProto}://${host}`));
    }

    return NextResponse.json({ success: true, repos: repos.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
