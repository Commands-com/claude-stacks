import { jest } from '@jest/globals';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import sampleStack from '../fixtures/sample-stack.json';

/**
 * Mock API responses for testing
 */
export const apiMocks = {
  // Stack API endpoints
  getStack: http.get('https://api.claude-stacks.com/api/stacks/:stackId', ({ params }) => {
    const { stackId } = params;

    if (stackId === 'example-org/web-stack') {
      return HttpResponse.json({
        success: true,
        data: sampleStack,
        message: 'Stack retrieved successfully',
      });
    }

    return HttpResponse.json(
      {
        success: false,
        message: 'Stack not found',
        error: 'STACK_NOT_FOUND',
      },
      { status: 404 }
    );
  }),

  // Publish stack
  publishStack: http.post('https://api.claude-stacks.com/api/stacks', async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      data: {
        id: (body as any).id,
        publishedAt: new Date().toISOString(),
        url: `https://claude-stacks.com/stacks/${(body as any).id}`,
      },
      message: 'Stack published successfully',
    });
  }),

  // Search stacks
  searchStacks: http.get('https://api.claude-stacks.com/api/stacks/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (query === 'web') {
      return HttpResponse.json({
        success: true,
        data: {
          stacks: [sampleStack],
          total: 1,
          page: 1,
          limit: 10,
        },
        message: 'Search completed',
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        stacks: [],
        total: 0,
        page: 1,
        limit: 10,
      },
      message: 'No stacks found',
    });
  }),

  // Browse stacks
  browseStacks: http.get('https://api.claude-stacks.com/api/stacks', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    return HttpResponse.json({
      success: true,
      data: {
        stacks: category === 'development' ? [sampleStack] : [],
        total: category === 'development' ? 1 : 0,
        page: 1,
        limit: 10,
      },
      message: 'Stacks retrieved successfully',
    });
  }),

  // Delete stack
  deleteStack: http.delete('https://api.claude-stacks.com/api/stacks/:stackId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      message: 'Stack deleted successfully',
    });
  }),

  // Authentication
  authenticate: http.post('https://api.claude-stacks.com/api/auth/login', async ({ request }) => {
    const body = await request.json();

    if ((body as any).token === 'valid-token') {
      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
          },
          token: 'jwt-token-123',
        },
        message: 'Authentication successful',
      });
    }

    return HttpResponse.json(
      {
        success: false,
        message: 'Invalid credentials',
        error: 'INVALID_CREDENTIALS',
      },
      { status: 401 }
    );
  }),
};

// Create MSW server instance
export const server = setupServer(...Object.values(apiMocks));

/**
 * Setup MSW for Node.js testing - call these functions in your test setup
 */
export function setupApiMocks() {
  return {
    server,
    startServer: () => server.listen({ onUnhandledRequest: 'warn' }),
    resetHandlers: () => server.resetHandlers(),
    closeServer: () => server.close(),
  };
}

/**
 * Mock fetch for direct testing
 */
export function mockFetch(): jest.MockedFunction<any> {
  const fetchMock = jest.fn();

  // Default successful response
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: null }),
    text: () => Promise.resolve('{}'),
  });

  return fetchMock;
}

/**
 * Mock network errors
 */
export function mockNetworkError(message = 'Network error'): void {
  server.use(
    http.all('*', () => {
      throw new Error(message);
    })
  );
}

/**
 * Mock specific API failures
 */
export function mockApiFailure(
  endpoint: string,
  status = 500,
  message = 'Internal server error'
): void {
  server.use(
    http.all(endpoint, () => {
      return HttpResponse.json(
        {
          success: false,
          message,
          error: 'SERVER_ERROR',
        },
        { status }
      );
    })
  );
}
