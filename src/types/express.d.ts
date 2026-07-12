import { User } from "../app/lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
