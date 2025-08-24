# Claude Stacks API Documentation

## Overview

The Claude Stacks API provides a complete backend service for publishing, sharing, and installing Claude Code development environments. This system allows users to package their commands, agents, and MCP server configurations into distributable stacks.

## Base URL

- **Local Development**: `http://localhost:3000`
- **Production**: `https://backend.commands.com`

All endpoints use the `/v1/stacks` prefix.

## Authentication

Most endpoints require gateway JWT token authentication. Include the token in the Authorization header:

```
Authorization: Bearer <gateway-jwt-token>
```

The API supports both Firebase ID tokens and Commands.com gateway JWT tokens:
- **Gateway JWT**: Issued by `https://api.commands.com` with JWKS validation
- **Firebase Token**: Legacy support for direct Firebase authentication
- **Token Source**: Automatically detected based on token format and issuer

### Auto-Organization Creation

For CLI users who don't have existing creator profiles, the system automatically creates organizations:

1. **Username Generation**: Derives username from email (`john.doe@example.com` → `johndoe`)
2. **Conflict Resolution**: Appends numbers if username exists (`johndoe1`, `johndoe2`, etc.)
3. **Profile Creation**: Creates minimal creator profile with `autoCreated: true` flag
4. **Organization Setup**: Links user to organization with full permissions

This ensures CLI users can immediately publish stacks without manual profile setup.

## Data Model

### Stack Structure

```json
{
  "name": "Stack Name",
  "description": "Stack description",
  "version": "1.0.0",
  "commands": [
    {
      "name": "command-name",
      "description": "Command description",
      "filePath": "~/.claude/commands/example.md",
      "content": "# Command content..."
    }
  ],
  "agents": [
    {
      "name": "agent-name", 
      "description": "Agent description",
      "filePath": "~/.claude/agents/example.md",
      "content": "# Agent content..."
    }
  ],
  "mcpServers": [
    {
      "name": "server-name",
      "type": "docker",
      "url": "https://example.com",
      "command": "docker run example",
      "args": ["--port", "8080"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  ],
  "settings": {},
  "public": true,
  "metadata": {}
}
```

## API Endpoints

### 1. Publish Stack

**POST** `/v1/stacks`

Publishes a new stack to the platform.

#### Authentication Required
✅ Yes

#### Request Body
```json
{
  "name": "My Development Stack",
  "description": "A complete React development environment",
  "commands": [...],
  "agents": [...],
  "mcpServers": [...],
  "public": true
}
```

#### Validation Rules
- **Name**: 3-100 characters, required
- **Description**: 1-500 characters, required
- **Commands**: Max 50 commands, each with name/filePath/content
- **Agents**: Max 20 agents, each with name/filePath/content
- **MCP Servers**: Max 20 servers, each with name/type
- **Total Size**: Max 5MB after serialization
- **Security**: Automatically sanitizes sensitive information (API keys, passwords, tokens)

#### Response
```json
{
  "stackId": "12345678-1234-1234-1234-123456789012",
  "message": "Stack published successfully",
  "url": "https://commands.com/stacks/12345678-1234-1234-1234-123456789012"
}
```

#### Error Responses
- `400`: Invalid stack data (detailed validation errors)
- `401`: Authentication required
- `500`: Server error

#### New User Flow
When a CLI user without an existing profile publishes their first stack:
1. Authentication succeeds via gateway JWT token
2. System detects missing organization and auto-creates:
   - Generates username from email (with conflict resolution)
   - Creates minimal creator profile marked as `autoCreated: true`
   - Creates organization record with full owner permissions
3. Stack publishing proceeds normally with new organization

### 2. Browse Stacks

**GET** `/v1/stacks`

Retrieves a list of stacks with filtering, search, and pagination.

#### Authentication Required
❌ No (for public stacks)
✅ Yes (for `myStacks=true`)

#### Query Parameters
- `search` (string): Search in name and description
- `limit` (number): Results per page (1-100, default: 20)
- `sort` (string): Sort order (`recent` or `popular`, default: `recent`)
- `myStacks` (boolean): Get user's own stacks (requires auth)
- `nextToken` (string): Pagination token

#### Response
```json
{
  "stacks": [
    {
      "stackId": "12345678-1234-1234-1234-123456789012",
      "name": "React Development Stack",
      "description": "Complete React dev environment",
      "author": "username",
      "commandCount": 5,
      "agentCount": 2,
      "mcpServerCount": 3,
      "viewCount": 150,
      "installCount": 45,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "nextToken": "base64-encoded-pagination-token"
}
```

#### Examples
```bash
# Browse public stacks
GET /v1/stacks

# Search for React stacks
GET /v1/stacks?search=react

# Get popular stacks
GET /v1/stacks?sort=popular&limit=10

# Get user's own stacks (requires auth)
GET /v1/stacks?myStacks=true
```

### 3. Get Full Stack

**GET** `/v1/stacks/:stackId`

Retrieves complete stack content including all commands, agents, and MCP servers.

#### Authentication Required
❌ No (for public stacks)
✅ Yes (for private stacks, must be owner)

#### Path Parameters
- `stackId` (string): UUID of the stack

#### Response
```json
{
  "stackId": "12345678-1234-1234-1234-123456789012",
  "name": "My Development Stack",
  "description": "Complete development environment",
  "author": "username",
  "version": "1.0.0",
  "commands": [...],
  "agents": [...],
  "mcpServers": [...],
  "settings": {},
  "stats": {
    "views": 150,
    "installs": 45
  }
}
```

#### Side Effects
- Increments view count automatically

#### Error Responses
- `400`: Invalid stack ID format
- `403`: Access denied (private stack, not owner)
- `404`: Stack not found
- `500`: Server error

### 4. Preview Stack

**GET** `/v1/stacks/:stackId/preview`

Retrieves stack metadata and component summaries without full content.

#### Authentication Required
❌ No (for public stacks)
✅ Yes (for private stacks, must be owner)

#### Response
```json
{
  "stackId": "12345678-1234-1234-1234-123456789012",
  "name": "My Development Stack",
  "description": "Complete development environment",
  "author": "username",
  "stats": {
    "views": 150,
    "installs": 45
  },
  "contents": {
    "global": {
      "commands": [
        {"name": "deploy", "description": "Deploy to production"}
      ],
      "agents": [
        {"name": "reviewer", "description": "Code review agent"}
      ]
    },
    "local": {
      "commands": [
        {"name": "test", "description": "Run local tests"}
      ],
      "agents": [],
      "mcpServers": [
        {"name": "database", "type": "docker"}
      ]
    }
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Content Categories
- **Global**: Components with file paths starting with `~` (user-wide)
- **Local**: Components with file paths starting with `.` (project-specific)

### 5. Track Installation

**POST** `/v1/stacks/:stackId/install`

Records that a stack was installed, incrementing analytics.

#### Authentication Required
❌ No

#### Response
```json
{
  "success": true,
  "installCount": 46
}
```

#### Notes
- Always returns success, even if tracking fails (to not block installations)
- Used by CLI to track adoption metrics
- Stack must exist to increment count

### 6. Delete Stack

**DELETE** `/v1/stacks/:stackId`

Permanently deletes a stack and all its content.

#### Authentication Required
✅ Yes

#### Authorization
- Stack owner can delete their own stacks
- Super admins can delete any stack

#### Response
```json
{
  "message": "Stack deleted successfully",
  "stackId": "12345678-1234-1234-1234-123456789012"
}
```

#### Side Effects
- Removes metadata from DynamoDB
- Deletes full content from S3
- Cannot be undone

#### Error Responses
- `400`: Invalid stack ID format
- `401`: Authentication required
- `403`: Not authorized (not owner, not admin)
- `404`: Stack not found
- `500`: Server error

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation errors, malformed data)
- `401`: Unauthorized (missing or invalid authentication)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

## Security Features

### Input Validation
- All inputs are validated against strict schemas
- File paths are validated for safety
- Content length limits enforced
- Component count limits enforced

### Content Sanitization
Automatically removes sensitive information from published stacks:
- API keys (`API_KEY=secret123`)
- Tokens (`TOKEN=abc123`)
- Passwords (`password=secret`)
- Private keys (`PRIVATE_KEY=xyz`)
- Access credentials

### Access Control
- Public stacks accessible to everyone
- Private stacks only accessible to owners
- Super admin override for moderation
- Firebase authentication integration

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Publish Stack | 10 per hour per user |
| Browse Stacks | 100 per minute |
| Get Stack | 50 per minute per IP |
| Other endpoints | 30 per minute per user |

## Usage Examples

### Publishing a Stack

```javascript
const response = await fetch('/v1/stacks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${firebaseToken}`
  },
  body: JSON.stringify({
    name: 'React Development Environment',
    description: 'Complete setup for React development',
    commands: [
      {
        name: 'create-component',
        description: 'Creates a new React component',
        filePath: '~/.claude/commands/create-component.md',
        content: '# Create Component\n\nCreate a new React component with TypeScript...'
      }
    ],
    agents: [],
    mcpServers: [
      {
        name: 'react-devtools',
        type: 'npm',
        command: 'npx react-devtools'
      }
    ],
    public: true
  })
});

const result = await response.json();
console.log('Published:', result.stackId);
```

### Searching Stacks

```javascript
const response = await fetch('/v1/stacks?search=react&sort=popular&limit=10');
const data = await response.json();

data.stacks.forEach(stack => {
  console.log(`${stack.name} by ${stack.author} - ${stack.installCount} installs`);
});
```

### Installing a Stack

```javascript
// Get full stack content
const stackResponse = await fetch(`/v1/stacks/${stackId}`);
const stack = await stackResponse.json();

// Track installation
await fetch(`/v1/stacks/${stackId}/install`, { method: 'POST' });

// Process stack content locally
installCommands(stack.commands);
installAgents(stack.agents);
configureMcpServers(stack.mcpServers);
```

## Database Schema

### DynamoDB Table: `stacks-table`

#### Primary Key
- `stackId` (String): UUID

#### Attributes
- `organizationUsername` (String): Publisher's username
- `name` (String): Stack name
- `description` (String): Stack description  
- `s3Key` (String): S3 object key for full content
- `isPublic` (String): "true" or "false"
- `userId` (String): Publisher's Firebase UID
- `commandCount` (Number): Number of commands
- `agentCount` (Number): Number of agents
- `mcpServerCount` (Number): Number of MCP servers
- `viewCount` (Number): View analytics
- `installCount` (Number): Install analytics
- `createdAt` (String): ISO timestamp
- `updatedAt` (String): ISO timestamp

#### Global Secondary Indexes
1. `userId-createdAt-index`: User's stacks by creation date
2. `isPublic-createdAt-index`: Public stacks by creation date
3. `isPublic-installCount-index`: Public stacks by popularity

### S3 Bucket: `stacks-bucket`

#### Object Structure
- Key: `stacks/{stackId}.json`
- Content: Full stack JSON with sanitized sensitive data
- Metadata: `stack-id`, `user-id`, `created-at`

## Monitoring & Analytics

### Metrics Tracked
- Stack publish rate
- Browse queries and filters used
- View counts per stack
- Installation counts per stack
- Popular search terms
- User engagement patterns

### Logs
- All API requests with response times
- Validation failures with details
- Authentication/authorization events
- Error occurrences with stack traces

## Future Enhancements

### Planned Features
- Stack versioning system
- Collaborative editing
- Stack templates and categories
- Import/export from GitHub repositories
- Stack dependency management
- Usage analytics dashboard
- Community ratings and reviews

### API Extensions
- `PATCH /v1/stacks/:id` - Update existing stacks
- `POST /v1/stacks/:id/fork` - Fork existing stacks
- `GET /v1/stacks/:id/versions` - List stack versions
- `GET /v1/users/:username/stacks` - User's public stacks
- `POST /v1/stacks/import/github` - Import from GitHub

This API provides a solid foundation for the Claude Stacks ecosystem, enabling developers to easily share and distribute their Claude Code configurations.