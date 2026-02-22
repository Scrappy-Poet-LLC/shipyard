import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstallationOctokit, fetchDeploymentInfo } from "@/lib/github";
import { Dashboard } from "@/components/dashboard";
import type {
  DeploymentInfo,
  Environment,
  LayoutOption,
  ServiceWithEnvironment,
  SortOption,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function getEnvironments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<Environment[]> {
  const { data } = await supabase
    .from("environments")
    .select("id, name, slug, commit_ceiling")
    .order("display_order");
  return (data as Environment[]) ?? [];
}

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

async function getServicesForEnvironment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  environmentSlug: string
): Promise<{ services: ServiceWithEnvironment[]; installationId: number | null }> {
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
    return { services: [], installationId: null };
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

  return { services, installationId };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ env?: string; sort?: string; layout?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();

  const supabase = await createSupabaseServerClient();
  const environments = await getEnvironments(supabase);

  if (environments.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800">
            No environments configured
          </h1>
          <p className="mt-2 text-gray-500">
            Run the Supabase migration to seed the environments table.
          </p>
        </div>
      </div>
    );
  }

  const envParam = params.env;
  const envCookie = cookieStore.get("env")?.value;
  const currentEnvironment =
    envParam ??
    envCookie ??
    environments[0].slug;

  const selectedEnv = environments.find((e) => e.slug === currentEnvironment);
  const commitCeiling = selectedEnv?.commit_ceiling ?? 30;

  const sortParam = params.sort as SortOption | undefined;
  const sortCookie = cookieStore.get("sort")?.value as SortOption | undefined;
  const validSorts: SortOption[] = ["deployed", "alpha", "staleness"];
  const currentSort: SortOption =
    sortParam && validSorts.includes(sortParam)
      ? sortParam
      : sortCookie && validSorts.includes(sortCookie)
        ? sortCookie
        : "deployed";

  const layoutParam = params.layout as LayoutOption | undefined;
  const layoutCookie = cookieStore.get("layout")?.value as LayoutOption | undefined;
  const validLayouts: LayoutOption[] = ["comfortable", "compact"];
  const currentLayout: LayoutOption =
    layoutParam && validLayouts.includes(layoutParam)
      ? layoutParam
        : layoutCookie && validLayouts.includes(layoutCookie)
        ? layoutCookie
        : "compact";

  const { services, installationId } = await getServicesForEnvironment(
    supabase,
    currentEnvironment
  );

  let deployments: DeploymentInfo[] = [];

  if (services.length > 0 && installationId !== null) {
    const octokit = await getInstallationOctokit(installationId);

    const results = await Promise.allSettled(
      services.map((service) =>
        fetchDeploymentInfo(octokit, service, commitCeiling)
      )
    );

    deployments = results.map((result, index) => {
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
        compare_url: null,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Failed to fetch deployment info",
      };
    });
  }

  return (
    <Dashboard
      deployments={deployments}
      environments={environments}
      currentEnvironment={currentEnvironment}
      currentSort={currentSort}
      currentLayout={currentLayout}
    />
  );
}
