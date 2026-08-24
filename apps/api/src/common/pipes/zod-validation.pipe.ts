import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/**
 * Validates request bodies against the same zod schemas exported from
 * @envvault/types that the web app and CLI use client-side — a single
 * source of truth for input validation instead of a parallel
 * class-validator DTO layer.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
