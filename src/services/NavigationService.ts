/**
 * Navigation context interface for tracking CLI navigation state
 *
 * Defines the structure for navigation contexts that track user movement
 * between different views in the Claude Stacks CLI. Each context maintains
 * information about the current view source and can reference a previous
 * context to enable breadcrumb navigation and back functionality.
 *
 * @since 1.3.4
 * @public
 */
export interface NavigationContext {
  /**
   * The source view or screen that this navigation context represents
   *
   * @remarks
   * Identifies the current view type in the CLI navigation flow:
   * - 'list': Local stacks listing view
   * - 'browse': Remote stacks browsing view
   * - 'local': Local stack detail view
   * - 'remote': Remote stack detail view
   *
   * @example
   * ```typescript
   * const context: NavigationContext = {
   *   source: 'list' // User is viewing local stacks list
   * };
   * ```
   */
  source: 'list' | 'browse' | 'local' | 'remote';

  /**
   * Reference to the previous navigation context in the navigation chain
   *
   * @remarks
   * Optional reference to the context that preceded this one, enabling
   * breadcrumb generation and back navigation functionality. Creates a
   * linked list structure for navigation history tracking.
   *
   * @example
   * ```typescript
   * const browseContext: NavigationContext = { source: 'browse' };
   * const remoteStackContext: NavigationContext = {
   *   source: 'remote',
   *   previousContext: browseContext // Can navigate back to browse view
   * };
   * ```
   */
  previousContext?: NavigationContext;
}

/**
 * Service for managing navigation state and context in the Claude Stacks CLI
 *
 * Provides a stack-based navigation system that tracks user movement between
 * different views (local stacks, remote browse, stack details). Maintains
 * navigation history to enable breadcrumb generation, back navigation, and
 * consistent user experience across the CLI interface.
 *
 * @remarks
 * The NavigationService uses a stack-based approach where each navigation
 * action pushes a new context onto the stack, maintaining a chain of previous
 * contexts. This enables features like breadcrumb trails, back navigation,
 * and understanding the user's navigation flow for better UX decisions.
 *
 * The service maintains both a navigation stack (for history) and current
 * context (for immediate state). When navigating "back", contexts are popped
 * from the stack to restore the previous state.
 *
 * @example
 * ```typescript
 * // Push navigation contexts as user navigates
 * navigationService.pushContext({ source: 'list' });
 * navigationService.pushContext({ source: 'browse' });
 *
 * // Generate breadcrumb for display
 * const breadcrumb = navigationService.getBreadcrumb();
 * // Returns: "💾 Local Stacks › 🌐 Browse Stacks"
 *
 * // Navigate back
 * navigationService.popContext();
 * // Now back at 'list' context
 * ```
 *
 * @since 1.3.4
 * @public
 */
export class NavigationService {
  private navigationStack: NavigationContext[] = [];
  private currentContext: NavigationContext | null = null;

  /**
   * Push a new navigation context onto the stack
   *
   * Adds a new navigation context to the stack, automatically linking it
   * to the current context as its previous context. This maintains the
   * navigation chain for breadcrumb generation and back navigation.
   *
   * @param context - The navigation context to push onto the stack
   *
   * @example
   * ```typescript
   * // Navigate from list to browse view
   * navigationService.pushContext({ source: 'browse' });
   *
   * // Current context is now 'browse' with previousContext linking to 'list'
   * ```
   *
   * @since 1.3.4
   * @public
   */
  pushContext(context: NavigationContext): void {
    if (this.currentContext) {
      context.previousContext = this.currentContext;
      this.navigationStack.push(this.currentContext);
    }
    this.currentContext = context;
  }

  /**
   * Pop the last navigation context from the stack and restore previous state
   *
   * Removes the most recent context from the navigation stack and restores
   * the previous context as current. This enables back navigation functionality
   * by reverting to the previous navigation state.
   *
   * @returns The restored navigation context, or null if stack is empty
   *
   * @example
   * ```typescript
   * // After navigating: list -> browse -> remote
   * const previousContext = navigationService.popContext();
   * // Now back at 'browse' context, previousContext contains browse details
   *
   * const earlierContext = navigationService.popContext();
   * // Now back at 'list' context
   * ```
   *
   * @since 1.3.4
   * @public
   */
  popContext(): NavigationContext | null {
    this.currentContext = this.navigationStack.pop() ?? null;
    return this.currentContext;
  }

  /**
   * Get the current navigation context
   *
   * Returns the currently active navigation context, which represents the
   * user's current location in the CLI navigation flow.
   *
   * @returns The current navigation context, or null if no context is set
   *
   * @example
   * ```typescript
   * const current = navigationService.getCurrentContext();
   * if (current?.source === 'browse') {
   *   // User is currently in the browse stacks view
   *   console.log('Showing remote stacks browser');
   * }
   * ```
   *
   * @since 1.3.4
   * @public
   */
  getCurrentContext(): NavigationContext | null {
    return this.currentContext;
  }

  /**
   * Check if back navigation is available
   *
   * Determines whether the user can navigate back to a previous context
   * by checking if there are any contexts stored in the navigation stack.
   *
   * @returns True if back navigation is possible, false otherwise
   *
   * @example
   * ```typescript
   * if (navigationService.canNavigateBack()) {
   *   // Show back button or enable back navigation
   *   console.log('< Back option available');
   * }
   * ```
   *
   * @since 1.3.4
   * @public
   */
  canNavigateBack(): boolean {
    return this.navigationStack.length > 0;
  }

  /**
   * Clear the navigation stack and reset navigation state
   *
   * Removes all contexts from the navigation stack and resets the current
   * context to null. This effectively resets the navigation state to its
   * initial empty state.
   *
   * @example
   * ```typescript
   * // Reset navigation when user exits to main menu
   * navigationService.clearStack();
   * // Navigation stack is now empty, no breadcrumbs or back navigation
   * ```
   *
   * @since 1.3.4
   * @public
   */
  clearStack(): void {
    this.navigationStack = [];
    this.currentContext = null;
  }

  /**
   * Generate a breadcrumb trail string for UI display
   *
   * Creates a human-readable breadcrumb trail showing the navigation path
   * from the root context to the current context. Each context is displayed
   * with its appropriate icon and label, separated by › characters.
   *
   * @returns Formatted breadcrumb string, or empty string if no current context
   *
   * @example
   * ```typescript
   * // After navigation: list -> browse -> remote stack
   * const breadcrumb = navigationService.getBreadcrumb();
   * // Returns: "💾 Local Stacks › 🌐 Browse Stacks › 🌐 Remote"
   *
   * // No current context
   * navigationService.clearStack();
   * const empty = navigationService.getBreadcrumb();
   * // Returns: ""
   * ```
   *
   * @since 1.3.4
   * @public
   */
  getBreadcrumb(): string {
    if (!this.currentContext) return '';

    const breadcrumbs: string[] = [];
    let context: NavigationContext | null = this.currentContext;

    while (context) {
      breadcrumbs.unshift(this.getContextDisplayName(context.source));
      context = context.previousContext ?? null;
    }

    return breadcrumbs.join(' › ');
  }

  /**
   * Get the display name with icon for a navigation context source
   *
   * Converts a navigation source type into a human-readable display string
   * with appropriate emoji icons for UI presentation.
   *
   * @param source - The navigation source to get display name for
   * @returns Formatted display string with icon and label
   *
   * @private
   */
  private getContextDisplayName(source: NavigationContext['source']): string {
    switch (source) {
      case 'list':
        return '💾 Local Stacks';
      case 'browse':
        return '🌐 Browse Stacks';
      case 'local':
        return '💾 Local';
      case 'remote':
        return '🌐 Remote';
      default:
        return source;
    }
  }
}

/**
 * Singleton instance of NavigationService for global navigation state management
 *
 * Provides a shared navigation service instance that maintains global navigation
 * state throughout the Claude Stacks CLI application. This singleton pattern ensures
 * consistent navigation tracking across all CLI commands and user interactions.
 *
 * @remarks
 * This singleton instance is used throughout the CLI to maintain navigation state
 * between different views and commands. It provides a centralized location for
 * managing navigation context, breadcrumbs, and back navigation functionality.
 *
 * The singleton pattern is used here because navigation state should be shared
 * across the entire application session and shouldn't be duplicated across
 * different parts of the codebase.
 *
 * @example
 * ```typescript
 * import { navigationService } from '../services/NavigationService.js';
 *
 * // Track navigation to browse view
 * navigationService.pushContext({ source: 'browse' });
 *
 * // Display breadcrumb in UI
 * console.log(navigationService.getBreadcrumb());
 * // Output: "🌐 Browse Stacks"
 *
 * // Handle back navigation
 * if (navigationService.canNavigateBack()) {
 *   navigationService.popContext();
 * }
 * ```
 *
 * @since 1.3.4
 * @public
 */
export const navigationService = new NavigationService();
