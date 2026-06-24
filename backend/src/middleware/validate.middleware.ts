// validate.middleware.ts — Zod schema validation factory.
//
// Usage:
//   router.post("/share", requireAuth, validate(shareSchema), shareController);
//
// On failure: returns 400 with {ok:false, error:{code:"VALIDATION_ERROR", fields:{}}}
// On success: req.body is typed as T and the next handler runs.

import { RequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendError } from "../utils/helpers";

export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      (result.error as ZodError).errors.forEach((e) => {
        const key = e.path.join(".");
        fields[key] = e.message;
      });
      sendError(res, 400, "VALIDATION_ERROR", "Request body is invalid", fields);
      return;
    }
    req.body = result.data as typeof req.body;
    next();
  };
}
