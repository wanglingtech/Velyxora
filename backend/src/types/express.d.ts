import type { UserRole } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; role: UserRole; email: string; sessionId: string };
    uploadContext?: { toolId: string; effectiveLimit: number; planCode: string; maxConcurrentJobs: number; commercialBypass: boolean };
  }
}
