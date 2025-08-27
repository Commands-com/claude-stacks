import type { NavigationContext } from '../../../src/services/NavigationService.js';
import { NavigationService } from '../../../src/services/NavigationService.js';

describe('NavigationService', () => {
  let navigationService: NavigationService;

  beforeEach(() => {
    navigationService = new NavigationService();
  });

  describe('constructor', () => {
    it('should initialize with empty navigation stack and null current context', () => {
      expect(navigationService.getCurrentContext()).toBeNull();
      expect(navigationService.canNavigateBack()).toBe(false);
      expect(navigationService.getBreadcrumb()).toBe('');
    });
  });

  describe('pushContext', () => {
    it('should push first context without previous context', () => {
      const context: NavigationContext = { source: 'list' };

      navigationService.pushContext(context);

      expect(navigationService.getCurrentContext()).toEqual(context);
      expect(navigationService.canNavigateBack()).toBe(false);
    });

    it('should push second context with previous context reference', () => {
      const firstContext: NavigationContext = { source: 'list' };
      const secondContext: NavigationContext = { source: 'browse' };

      navigationService.pushContext(firstContext);
      navigationService.pushContext(secondContext);

      const current = navigationService.getCurrentContext();
      expect(current?.source).toBe('browse');
      expect(current?.previousContext?.source).toBe('list');
      expect(navigationService.canNavigateBack()).toBe(true);
    });

    it('should handle multiple nested contexts', () => {
      const contexts: NavigationContext[] = [
        { source: 'list' },
        { source: 'browse' },
        { source: 'remote' },
        { source: 'local' },
      ];

      contexts.forEach(context => navigationService.pushContext(context));

      expect(navigationService.getCurrentContext()?.source).toBe('local');
      expect(navigationService.canNavigateBack()).toBe(true);
    });
  });

  describe('popContext', () => {
    it('should return null when popping from empty stack', () => {
      const result = navigationService.popContext();

      expect(result).toBeNull();
      expect(navigationService.getCurrentContext()).toBeNull();
    });

    it('should pop to previous context', () => {
      const firstContext: NavigationContext = { source: 'list' };
      const secondContext: NavigationContext = { source: 'browse' };

      navigationService.pushContext(firstContext);
      navigationService.pushContext(secondContext);

      const popped = navigationService.popContext();

      expect(popped?.source).toBe('list');
      expect(navigationService.getCurrentContext()?.source).toBe('list');
      expect(navigationService.canNavigateBack()).toBe(false);
    });

    it('should handle multiple pops correctly', () => {
      const contexts: NavigationContext[] = [
        { source: 'list' },
        { source: 'browse' },
        { source: 'remote' },
      ];

      contexts.forEach(context => navigationService.pushContext(context));

      navigationService.popContext();
      expect(navigationService.getCurrentContext()?.source).toBe('browse');

      navigationService.popContext();
      expect(navigationService.getCurrentContext()?.source).toBe('list');

      const final = navigationService.popContext();
      expect(final).toBeNull();
      expect(navigationService.getCurrentContext()).toBeNull();
    });
  });

  describe('getCurrentContext', () => {
    it('should return null initially', () => {
      expect(navigationService.getCurrentContext()).toBeNull();
    });

    it('should return current context after push', () => {
      const context: NavigationContext = { source: 'browse' };
      navigationService.pushContext(context);

      expect(navigationService.getCurrentContext()?.source).toBe('browse');
    });

    it('should return updated context after multiple operations', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.popContext();

      expect(navigationService.getCurrentContext()?.source).toBe('list');
    });
  });

  describe('canNavigateBack', () => {
    it('should return false when no contexts', () => {
      expect(navigationService.canNavigateBack()).toBe(false);
    });

    it('should return false with only one context', () => {
      navigationService.pushContext({ source: 'list' });
      expect(navigationService.canNavigateBack()).toBe(false);
    });

    it('should return true with multiple contexts', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      expect(navigationService.canNavigateBack()).toBe(true);
    });

    it('should return false after popping all contexts', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.popContext();

      expect(navigationService.canNavigateBack()).toBe(false);
    });
  });

  describe('clearStack', () => {
    it('should clear empty stack', () => {
      navigationService.clearStack();

      expect(navigationService.getCurrentContext()).toBeNull();
      expect(navigationService.canNavigateBack()).toBe(false);
      expect(navigationService.getBreadcrumb()).toBe('');
    });

    it('should clear stack with contexts', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });

      navigationService.clearStack();

      expect(navigationService.getCurrentContext()).toBeNull();
      expect(navigationService.canNavigateBack()).toBe(false);
      expect(navigationService.getBreadcrumb()).toBe('');
    });

    it('should allow new contexts after clearing', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.clearStack();
      navigationService.pushContext({ source: 'browse' });

      expect(navigationService.getCurrentContext()?.source).toBe('browse');
      expect(navigationService.canNavigateBack()).toBe(false);
    });
  });

  describe('getBreadcrumb', () => {
    it('should return empty string when no context', () => {
      expect(navigationService.getBreadcrumb()).toBe('');
    });

    it('should return single context breadcrumb', () => {
      navigationService.pushContext({ source: 'list' });

      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks');
    });

    it('should return multiple context breadcrumb', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });

      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks › 🌐 Browse Stacks');
    });

    it('should handle deep navigation breadcrumb', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.pushContext({ source: 'remote' });

      expect(navigationService.getBreadcrumb()).toBe(
        '💾 Local Stacks › 🌐 Browse Stacks › 🌐 Remote'
      );
    });

    it('should update breadcrumb after pop', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.popContext();

      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks');
    });
  });

  describe('getContextDisplayName', () => {
    it('should return correct display names for all source types', () => {
      const testCases: Array<{ source: NavigationContext['source']; expected: string }> = [
        { source: 'list', expected: '💾 Local Stacks' },
        { source: 'browse', expected: '🌐 Browse Stacks' },
        { source: 'local', expected: '💾 Local' },
        { source: 'remote', expected: '🌐 Remote' },
      ];

      testCases.forEach(({ source, expected }) => {
        navigationService.pushContext({ source });
        expect(navigationService.getBreadcrumb()).toBe(expected);
        navigationService.clearStack();
      });
    });

    it('should handle default case for unknown source types', () => {
      // Test the default case in getContextDisplayName
      const unknownSource = 'unknown' as NavigationContext['source'];
      navigationService.pushContext({ source: unknownSource });

      expect(navigationService.getBreadcrumb()).toBe('unknown');
    });
  });

  describe('NavigationContext interface', () => {
    it('should handle context with custom properties', () => {
      const context: NavigationContext = {
        source: 'browse',
        // TypeScript should enforce the interface
      };

      navigationService.pushContext(context);
      expect(navigationService.getCurrentContext()?.source).toBe('browse');
    });

    it('should handle previousContext property correctly', () => {
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });

      const current = navigationService.getCurrentContext();
      expect(current?.previousContext).toBeDefined();
      expect(current?.previousContext?.source).toBe('list');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle multiple clearStack calls', () => {
      navigationService.clearStack();
      navigationService.clearStack();

      expect(navigationService.getCurrentContext()).toBeNull();
    });

    it('should handle multiple popContext calls on empty stack', () => {
      const result1 = navigationService.popContext();
      const result2 = navigationService.popContext();

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should maintain integrity after mixed operations', () => {
      // Complex sequence of operations
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.popContext();
      navigationService.pushContext({ source: 'remote' });
      navigationService.clearStack();
      navigationService.pushContext({ source: 'local' });

      expect(navigationService.getCurrentContext()?.source).toBe('local');
      expect(navigationService.canNavigateBack()).toBe(false);
      expect(navigationService.getBreadcrumb()).toBe('💾 Local');
    });
  });

  describe('state consistency', () => {
    it('should maintain consistent state across operations', () => {
      // Test that internal state remains consistent
      navigationService.pushContext({ source: 'list' });
      const context1 = navigationService.getCurrentContext();

      navigationService.pushContext({ source: 'browse' });
      const context2 = navigationService.getCurrentContext();

      // Current context should have reference to previous
      expect(context2?.previousContext).toBe(context1);

      // After pop, should return to previous state
      navigationService.popContext();
      expect(navigationService.getCurrentContext()).toBe(context1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical user navigation flow', () => {
      // User starts in list
      navigationService.pushContext({ source: 'list' });
      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks');

      // User navigates to browse
      navigationService.pushContext({ source: 'browse' });
      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks › 🌐 Browse Stacks');
      expect(navigationService.canNavigateBack()).toBe(true);

      // User goes back
      navigationService.popContext();
      expect(navigationService.getBreadcrumb()).toBe('💾 Local Stacks');
      expect(navigationService.canNavigateBack()).toBe(false);
    });

    it('should handle navigation reset scenarios', () => {
      // Build up navigation state
      navigationService.pushContext({ source: 'list' });
      navigationService.pushContext({ source: 'browse' });
      navigationService.pushContext({ source: 'remote' });

      // Clear and start fresh (e.g., user exits to main menu)
      navigationService.clearStack();
      expect(navigationService.getBreadcrumb()).toBe('');

      // Start new navigation flow
      navigationService.pushContext({ source: 'browse' });
      expect(navigationService.getBreadcrumb()).toBe('🌐 Browse Stacks');
    });
  });
});
