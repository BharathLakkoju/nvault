import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as not requiring authentication. The global JwtAuthGuard
 * denies by default; routes must opt out explicitly rather than opt in,
 * so a forgotten guard can never accidentally expose an endpoint.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
