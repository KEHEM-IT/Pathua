// auth.middleware.ts — verifies the Firebase ID token on every protected route.
//
// The client (Chrome Extension) sends:
//   Authorization: Bearer <Firebase ID token>
//
// We verify it with Firebase Admin SDK (no network round-trip after the first
// JWKS fetch — the SDK caches the public keys). The decoded uid is attached to
// req.uid so controllers never touch the token again.

import { RequestHandler, Request, Response, NextFunction } from "express";
import { getAuth } from "../firebase/admin";
import { sendError } from "../utils/helpers";
import { AuthenticatedRequest } from "../types";

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHENTICATED", "Missing or malformed Authorization header");
    return;
  }
  const idToken = header.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    (req as AuthenticatedRequest).uid = decoded.uid;
    next();
  } catch {
    sendError(res, 401, "INVALID_TOKEN", "Firebase ID token is invalid or expired");
  }
};
