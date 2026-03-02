import type { User, Pseudonym } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "email">;
      pseudonym?: Pseudonym;
    }
  }
}

export {};