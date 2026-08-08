export class PresenceManager {
  private static instance: PresenceManager;
  // Map of userId -> Set of socket IDs (to support multiple tabs/devices per user)
  private userSockets = new Map<string, Set<string>>();
  // Map of socketId -> userId (for fast lookup on disconnect)
  private socketToUser = new Map<string, string>();

  private constructor() {}

  public static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  /**
   * Track a socket connection for a user.
   * @returns boolean - true if this is the user's first active connection (just came online)
   */
  public addSocket(userId: string, socketId: string): boolean {
    let sockets = this.userSockets.get(userId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set<string>();
      this.userSockets.set(userId, sockets);
    }

    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);

    return isFirstConnection;
  }

  /**
   * Remove a socket connection on disconnect.
   * @returns object with userId and isCompletelyOffline flag
   */
  public removeSocket(socketId: string): {
    userId: string | null;
    isCompletelyOffline: boolean;
  } {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return { userId: null, isCompletelyOffline: false };
    }

    this.socketToUser.delete(socketId);
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        return { userId, isCompletelyOffline: true };
      }
    }

    return { userId, isCompletelyOffline: false };
  }

  public isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
}

export const presenceManager = PresenceManager.getInstance();
