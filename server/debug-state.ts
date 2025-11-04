/**
 * Debug Mode State Management
 *
 * Manages the debug mode state which can be toggled via the admin UI
 */

class DebugStateManager {
  private debugEnabled: boolean;

  constructor() {
    // Initialize from environment variable, default to true in development
    const envValue = process.env.DEBUG_MODE;
    this.debugEnabled = envValue !== "false";

    console.log(`[Debug State] Initial debug mode: ${this.debugEnabled}`);
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Enable debug mode
   */
  enable(): void {
    this.debugEnabled = true;
    console.log("[Debug State] Debug mode ENABLED");
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.debugEnabled = false;
    console.log("[Debug State] Debug mode DISABLED");
  }

  /**
   * Toggle debug mode
   */
  toggle(): boolean {
    this.debugEnabled = !this.debugEnabled;
    console.log(`[Debug State] Debug mode toggled to: ${this.debugEnabled}`);
    return this.debugEnabled;
  }

  /**
   * Set debug mode
   */
  set(enabled: boolean): void {
    this.debugEnabled = enabled;
    console.log(`[Debug State] Debug mode set to: ${this.debugEnabled}`);
  }
}

// Singleton instance
export const debugState = new DebugStateManager();
