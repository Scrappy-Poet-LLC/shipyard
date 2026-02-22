import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getInstallationOctokit,
  listRepoWorkflows,
  detectEnvironmentForWorkflow,
} from "@/lib/github";

async function verifySignature(
  body: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");

  if (!(await verifySignature(body, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "installation_repositories") {
    return NextResponse.json({ ok: true });
  }

  const payload = JSON.parse(body);
  const installationId: number = payload.installation.id;
  const action: string = payload.action;
  const supabase = createSupabaseAdminClient();

  const { data: installation } = await supabase
    .from("github_installations")
    .select("id")
    .eq("installation_id", installationId)
    .single();

  if (!installation) {
    return NextResponse.json(
      { error: "Unknown installation" },
      { status: 404 }
    );
  }

  const { data: environments } = await supabase
    .from("environments")
    .select("id, slug");

  if (!environments) {
    return NextResponse.json({ error: "No environments" }, { status: 500 });
  }

  const envBySlug = new Map(environments.map((e) => [e.slug, e.id]));

  if (action === "added") {
    const addedRepos: Array<{
      full_name: string;
      name: string;
      default_branch?: string;
    }> = payload.repositories_added ?? [];

    const octokit = await getInstallationOctokit(installationId);

    for (const repo of addedRepos) {
      const { data: service } = await supabase
        .from("services")
        .upsert(
          {
            display_name: repo.name,
            github_repo: repo.full_name,
            default_branch: repo.default_branch ?? "main",
            installation_id: installation.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "github_repo" }
        )
        .select("id")
        .single();

      if (!service) continue;

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
  }

  if (action === "removed") {
    const removedRepos: Array<{ full_name: string }> =
      payload.repositories_removed ?? [];

    for (const repo of removedRepos) {
      await supabase.from("services").delete().eq("github_repo", repo.full_name);
    }
  }

  return NextResponse.json({ ok: true });
}
