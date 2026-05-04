import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
    permissions: string[];
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "تکایە پێشتر بچۆرە ژوورەوە" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "تکایە پێشتر بچۆرە ژوورەوە" });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "دەسەڵاتت نییە" });
    return;
  }
  next();
}
