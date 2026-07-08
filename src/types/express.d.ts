declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        emailVerified: boolean;
        role?: string | null;
        name: string;
        banned?: boolean | null;
      };
    }
  }
}

export {};
