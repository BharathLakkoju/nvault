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
    const notes: string[] = [];
    if (org.status === "INVITED") notes.push("awaiting key access");
    if (org.orgStatus === "PENDING_PAYMENT") notes.push("payment pending");
    if (org.orgStatus === "SUSPENDED") notes.push("subscription inactive");
    const suffix = notes.length ? `  (${notes.join(", ")})` : "";
    console.log(
      `  ${org.name}  ·  ${role}  ·  ${org.projectCount ?? 0} project${org.projectCount === 1 ? "" : "s"}${suffix}`,
    );
  }
  console.log("\nCreate organizations and manage billing & members from the web app.");
}
