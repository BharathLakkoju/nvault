import { apiRequest } from "../lib/api-client";

export async function whoamiCommand(): Promise<void> {
  const me = await apiRequest<{ user: { email: string; name: string | null } }>("/auth/me");
  console.log(me.user.name ? `${me.user.name} <${me.user.email}>` : me.user.email);
}
