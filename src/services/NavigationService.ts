/**
 * Service for managing navigation state between local and remote stack views
 * Provides consistent navigation patterns and state management
 *
 * @since 1.3.4
 */
export interface NavigationContext {
  source: 'list' | 'browse' | 'local' | 'remote';
  previousContext?: NavigationContext;
}

export class NavigationService {
  private navigationStack: NavigationContext[] = [];
  private currentContext: NavigationContext | null = null;

  /**
   * Push a new navigation context onto the stack
   */
  pushContext(context: NavigationContext): void {
    if (this.currentContext) {
      context.previousContext = this.currentContext;
      this.navigationStack.push(this.currentContext);
    }
    this.currentContext = context;
  }

  /**
   * Pop the last navigation context from the stack
   */
  popContext(): NavigationContext | null {
    this.currentContext = this.navigationStack.pop() ?? null;
    return this.currentContext;
  }

  /**
   * Get the current navigation context
   */
  getCurrentContext(): NavigationContext | null {
    return this.currentContext;
  }

  /**
   * Check if we can navigate back
   */
  canNavigateBack(): boolean {
    return this.navigationStack.length > 0;
  }

  /**
   * Clear the navigation stack
   */
  clearStack(): void {
    this.navigationStack = [];
    this.currentContext = null;
  }

  /**
   * Get navigation breadcrumb for display
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

// Singleton instance for global navigation state
export const navigationService = new NavigationService();
