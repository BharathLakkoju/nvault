import { apiRequest } from "../lib/api-client";
import type { OrganizationSummaryDto } from "../lib/types";

export async function orgsCommand(): Promise<void> {
  const { organizations } = await apiRequest<{ organizations: OrganizationSummaryDto[] }>(
    "/organizations",
  );
  if (organizations.length === 0) {
    console.log("You're not in any organization. Create one from the web app.");
    return;
  }
  console.log("Organizations\n");
  for (const org of organizations) {
    const role = org.role ? org.role.toLowerCase() : "member";
    const pending = org.status === "INVITED" ? "  (awaiting key access)" : "";
    console.log(
      `  ${org.name}  ·  ${role}  ·  ${org.projectCount ?? 0} project${org.projectCount === 1 ? "" : "s"}${pending}`,
    );
  }
  console.log("\nManage members and invitations from the web app.");
}
