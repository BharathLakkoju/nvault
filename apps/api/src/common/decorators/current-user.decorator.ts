import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext, AuthenticatedRequest } from "../request-context";

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.auth;
});
