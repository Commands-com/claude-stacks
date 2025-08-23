# Claude Stacks MVP Backend Implementation Plan

## Overview
Build a minimal viable backend for Claude Stacks that enables users to publish, share, view, and install complete Claude Code development environments with basic usage tracking.

## Core Philosophy
- **Minimal complexity** - Use existing infrastructure where possible
- **Fast to implement** - Target 1-2 days of development
- **Learn from usage** - Add features based on actual user behavior
- **Keep OAuth** - Already implemented and working in CLI

## Core Features

### 1. Publish
- Share stacks to Commands.com
- Requires authentication (OAuth/Firebase)
- Store metadata in DynamoDB, full JSON in S3

### 2. Browse
- List available public stacks
- Sort by recent or popular (install count)
- No authentication required

### 3. View
- Preview stack contents before installing
- Shows what will be installed (global vs local)
- Increments view counter

### 4. Install
- Restore a remote stack
- Tracks installation for popularity metrics
- Already implemented in CLI

### 5. Remove
- Delete your own published stacks
- Owner-only operation
- Requires authentication

### 6. Track
- Simple view/install counters
- No complex analytics for MVP
- Counters stored directly in stack record

## Database Design

### DynamoDB Table: StacksTable

```yaml
TableName: stacks-table
Partition Key: stackId (String, UUID)

Attributes:
  - stackId: String (UUID)
  - organizationUsername: String
  - name: String
  - description: String
  - s3Key: String (pointer to S3 object)
  - isPublic: Boolean
  - userId: String (Firebase UID)
  - commandCount: Number
  - agentCount: Number
  - mcpServerCount: Number
  - viewCount: Number (default 0)
  - installCount: Number (default 0)
  - createdAt: String (ISO timestamp)
  - updatedAt: String (ISO timestamp)

Global Secondary Indexes:
  1. userId-createdAt-index
     - Partition Key: userId
     - Sort Key: createdAt
     - Purpose: List user's own stacks

  2. isPublic-createdAt-index
     - Partition Key: isPublic
     - Sort Key: createdAt
     - Purpose: Browse recent public stacks

  3. isPublic-installCount-index
     - Partition Key: isPublic
     - Sort Key: installCount
     - Purpose: Browse popular public stacks
```

### S3 Bucket: stacks-bucket

```
Structure:
  /stacks/{stackId}.json - Full stack JSON content

Permissions:
  - App Runner can read/write
  - CloudFront distribution for CDN (optional for MVP)
```

## API Endpoints

### 1. POST /v1/stacks
**Purpose**: Publish a new stack  
**Auth**: Required (OAuth/Firebase token)  
**Request Body**:
```json
{
  "name": "React Development Stack",
  "description": "Complete React setup with TypeScript",
  "commands": [...],
  "agents": [...],
  "mcpServers": [...],
  "settings": {...},
  "public": true
}
```
**Response**: 
```json
{
  "stackId": "uuid-here",
  "message": "Stack published successfully"
}
```
**Actions**:
- Generate UUID for stackId
- Store metadata in DynamoDB
- Store full JSON in S3
- Initialize counters to 0

### 2. GET /v1/stacks
**Purpose**: Browse public stacks  
**Auth**: Not required  
**Query Parameters**:
- `search` (optional search term, searches name + description)
- `limit` (default: 20, max: 100)
- `nextToken` (for pagination)
- `sort` (values: "recent", "popular", default: "recent")
- `myStacks` (boolean, requires auth, shows user's stacks)

**Response**:
```json
{
  "stacks": [
    {
      "stackId": "uuid-here",
      "name": "React Development Stack",
      "description": "Complete React setup",
      "author": "johndoe",
      "commandCount": 5,
      "agentCount": 2,
      "mcpServerCount": 1,
      "viewCount": 230,
      "installCount": 45,
      "createdAt": "2024-01-15T..."
    }
  ],
  "nextToken": "pagination-token"
}
```

### 3. GET /v1/stacks/{stackId}
**Purpose**: Get full stack content  
**Auth**: Required for private stacks  
**Response**: Full stack JSON from S3  
**Side Effect**: Increment viewCount

### 4. GET /v1/stacks/{stackId}/preview
**Purpose**: Get lightweight preview without full content  
**Auth**: Required for private stacks  
**Response**:
```json
{
  "name": "React Development Stack",
  "description": "Complete React setup",
  "author": "johndoe",
  "stats": {
    "views": 230,
    "installs": 45
  },
  "contents": {
    "global": {
      "commands": ["test-runner", "build-optimizer"],
      "agents": ["code-reviewer"]
    },
    "local": {
      "commands": ["project-setup"],
      "mcpServers": ["github", "postgres"]
    }
  }
}
```

### 5. POST /v1/stacks/{stackId}/install
**Purpose**: Track installation  
**Auth**: Not required  
**Response**: `{ "success": true }`  
**Side Effect**: Increment installCount

### 6. DELETE /v1/stacks/{stackId}
**Purpose**: Delete a stack  
**Auth**: Required (must be owner)  
**Response**: `{ "message": "Stack deleted successfully" }`  
**Actions**:
- Verify ownership
- Delete from DynamoDB
- Delete from S3

## CLI Updates

### New Commands

#### claude-stacks view [stack-id]
Shows detailed preview of stack contents:
```bash
$ claude-stacks view abc123

📦 React Development Stack
by: johndoe | 45 installs | 230 views

This stack contains:

GLOBAL (~/.claude/):
  Commands (3):
    ✓ test-runner - Run tests with coverage
    ✓ build-optimizer - Optimize build output
    ✓ deploy-helper - Deploy to various platforms

  Agents (2):
    ✓ code-reviewer - Reviews code for best practices
    ✓ performance-analyzer - Analyzes performance

LOCAL (./.claude/):
  Commands (1):
    ✓ project-setup - Project-specific setup

  MCP Servers (2):
    ✓ github - GitHub integration
    ✓ postgres - PostgreSQL tools

Install this stack? (y/n)
```

#### claude-stacks remove [stack-id]
Deletes a published stack:
```bash
$ claude-stacks remove abc123
Are you sure you want to delete "React Development Stack"? (y/n) y
✅ Stack deleted successfully
```

#### claude-stacks list --mine
Lists user's own published stacks:
```bash
$ claude-stacks list --mine
Your published stacks:
1. React Development Stack (45 installs)
2. Node.js API Stack (12 installs)
```

### Updated Commands

#### claude-stacks browse [search-term]
Update to show install/view counts and support search:
```bash
# Browse all stacks
$ claude-stacks browse

📋 Available Stacks:

1. React Development Stack
   by: johndoe | 45 installs | 230 views
   Commands: 4 | Agents: 2 | MCP: 2

2. Node.js API Stack
   by: janedoe | 23 installs | 145 views
   Commands: 6 | Agents: 1 | MCP: 3

# Search for specific stacks
$ claude-stacks browse golang

📋 Stacks matching "golang":

1. Go Microservices Stack
   by: gopher123 | 89 installs | 412 views
   Commands: 8 | Agents: 3 | MCP: 2

2. Golang Testing Suite
   by: testmaster | 34 installs | 156 views
   Commands: 5 | Agents: 1 | MCP: 1
```

#### claude-stacks install-remote
Update to call `/v1/stacks/{stackId}/install` after successful installation

## Search Implementation Notes

For the MVP, search is implemented as a simple filter on the query results:
- Uses DynamoDB's `contains()` function to search name and description
- Case-insensitive search (convert to lowercase)
- Searches after the index query, so it's not the most efficient
- Good enough for MVP with limited number of stacks

Future improvements could include:
- Elasticsearch for full-text search
- Search tags and component names
- Fuzzy matching
- Search suggestions/autocomplete

## Implementation Files

### Backend (Commands.com App)

#### 1. template.yaml updates
```yaml
# Add to Resources section:
StacksTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: stacks-table
    AttributeDefinitions:
      - AttributeName: stackId
        AttributeType: S
      - AttributeName: userId
        AttributeType: S
      - AttributeName: isPublic
        AttributeType: S
      - AttributeName: createdAt
        AttributeType: S
      - AttributeName: installCount
        AttributeType: N
    KeySchema:
      - AttributeName: stackId
        KeyType: HASH
    GlobalSecondaryIndexes:
      - IndexName: userId-createdAt-index
        KeySchema:
          - AttributeName: userId
            KeyType: HASH
          - AttributeName: createdAt
            KeyType: RANGE
        Projection:
          ProjectionType: ALL
      # ... other indexes
    BillingMode: PAY_PER_REQUEST

StacksBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Sub "${AWS::StackName}-stacks-${AWS::AccountId}"
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
```

#### 2. src/handlers/stacksHandler.js (NEW)
```javascript
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { verifyFirebaseToken } = require('../shared/firebaseAdmin');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const STACKS_TABLE = process.env.STACKS_TABLE_NAME;
const STACKS_BUCKET = process.env.STACKS_BUCKET_NAME;

async function publishStack(req, res) {
  try {
    // Verify auth
    const user = await verifyFirebaseToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stack = req.body;
    const stackId = uuidv4();
    const timestamp = new Date().toISOString();

    // Count components
    const commandCount = (stack.commands || []).length;
    const agentCount = (stack.agents || []).length;
    const mcpServerCount = (stack.mcpServers || []).length;

    // Store metadata in DynamoDB
    await dynamodb.put({
      TableName: STACKS_TABLE,
      Item: {
        stackId,
        organizationUsername: user.organizationUsername || user.uid,
        name: stack.name,
        description: stack.description,
        s3Key: `stacks/${stackId}.json`,
        isPublic: stack.public ? 'true' : 'false',
        userId: user.uid,
        commandCount,
        agentCount,
        mcpServerCount,
        viewCount: 0,
        installCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }).promise();

    // Store full stack in S3
    await s3.putObject({
      Bucket: STACKS_BUCKET,
      Key: `stacks/${stackId}.json`,
      Body: JSON.stringify(stack),
      ContentType: 'application/json'
    }).promise();

    res.json({ stackId, message: 'Stack published successfully' });
  } catch (error) {
    console.error('Error publishing stack:', error);
    res.status(500).json({ error: 'Failed to publish stack' });
  }
}

async function browseStacks(req, res) {
  try {
    const { search, limit = 20, sort = 'recent', myStacks, nextToken } = req.query;
    
    let params = {
      TableName: STACKS_TABLE,
      Limit: Math.min(parseInt(limit), 100)
    };

    if (myStacks) {
      // Verify auth for "my stacks"
      const user = await verifyFirebaseToken(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      params.IndexName = 'userId-createdAt-index';
      params.KeyConditionExpression = 'userId = :userId';
      params.ExpressionAttributeValues = { ':userId': user.uid };
      params.ScanIndexForward = false; // newest first
    } else {
      // Public stacks
      params.IndexName = sort === 'popular' 
        ? 'isPublic-installCount-index' 
        : 'isPublic-createdAt-index';
      params.KeyConditionExpression = 'isPublic = :public';
      params.ExpressionAttributeValues = { ':public': 'true' };
      params.ScanIndexForward = false;
    }

    // Add search filter if provided
    if (search) {
      params.FilterExpression = 'contains(#name, :search) OR contains(#desc, :search)';
      params.ExpressionAttributeNames = {
        '#name': 'name',
        '#desc': 'description'
      };
      params.ExpressionAttributeValues = {
        ...params.ExpressionAttributeValues,
        ':search': search.toLowerCase()
      };
    }

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await dynamodb.query(params).promise();

    const response = {
      stacks: result.Items.map(item => ({
        stackId: item.stackId,
        name: item.name,
        description: item.description,
        author: item.organizationUsername,
        commandCount: item.commandCount,
        agentCount: item.agentCount,
        mcpServerCount: item.mcpServerCount,
        viewCount: item.viewCount,
        installCount: item.installCount,
        createdAt: item.createdAt
      }))
    };

    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    res.json(response);
  } catch (error) {
    console.error('Error browsing stacks:', error);
    res.status(500).json({ error: 'Failed to browse stacks' });
  }
}

async function getStack(req, res) {
  try {
    const { stackId } = req.params;

    // Get metadata from DynamoDB
    const metadata = await dynamodb.get({
      TableName: STACKS_TABLE,
      Key: { stackId }
    }).promise();

    if (!metadata.Item) {
      return res.status(404).json({ error: 'Stack not found' });
    }

    // Check if private stack
    if (metadata.Item.isPublic !== 'true') {
      const user = await verifyFirebaseToken(req.headers.authorization);
      if (!user || user.uid !== metadata.Item.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Increment view count
    await dynamodb.update({
      TableName: STACKS_TABLE,
      Key: { stackId },
      UpdateExpression: 'SET viewCount = viewCount + :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    }).promise();

    // Get full stack from S3
    const s3Object = await s3.getObject({
      Bucket: STACKS_BUCKET,
      Key: metadata.Item.s3Key
    }).promise();

    const stack = JSON.parse(s3Object.Body.toString());
    res.json(stack);
  } catch (error) {
    console.error('Error getting stack:', error);
    res.status(500).json({ error: 'Failed to get stack' });
  }
}

async function previewStack(req, res) {
  try {
    const { stackId } = req.params;

    // Get metadata from DynamoDB
    const metadata = await dynamodb.get({
      TableName: STACKS_TABLE,
      Key: { stackId }
    }).promise();

    if (!metadata.Item) {
      return res.status(404).json({ error: 'Stack not found' });
    }

    // Check if private stack
    if (metadata.Item.isPublic !== 'true') {
      const user = await verifyFirebaseToken(req.headers.authorization);
      if (!user || user.uid !== metadata.Item.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get full stack from S3 for preview
    const s3Object = await s3.getObject({
      Bucket: STACKS_BUCKET,
      Key: metadata.Item.s3Key
    }).promise();

    const stack = JSON.parse(s3Object.Body.toString());

    // Build preview response
    const preview = {
      name: stack.name,
      description: stack.description,
      author: metadata.Item.organizationUsername,
      stats: {
        views: metadata.Item.viewCount,
        installs: metadata.Item.installCount
      },
      contents: {
        global: {
          commands: (stack.commands || [])
            .filter(c => c.filePath?.startsWith('~'))
            .map(c => c.name),
          agents: (stack.agents || [])
            .filter(a => a.filePath?.startsWith('~'))
            .map(a => a.name)
        },
        local: {
          commands: (stack.commands || [])
            .filter(c => c.filePath?.startsWith('.'))
            .map(c => c.name),
          mcpServers: (stack.mcpServers || []).map(m => m.name)
        }
      }
    };

    res.json(preview);
  } catch (error) {
    console.error('Error previewing stack:', error);
    res.status(500).json({ error: 'Failed to preview stack' });
  }
}

async function trackInstall(req, res) {
  try {
    const { stackId } = req.params;

    // Increment install count
    await dynamodb.update({
      TableName: STACKS_TABLE,
      Key: { stackId },
      UpdateExpression: 'SET installCount = installCount + :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    }).promise();

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking install:', error);
    res.status(500).json({ error: 'Failed to track install' });
  }
}

async function deleteStack(req, res) {
  try {
    const { stackId } = req.params;
    
    // Verify auth
    const user = await verifyFirebaseToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get stack metadata
    const metadata = await dynamodb.get({
      TableName: STACKS_TABLE,
      Key: { stackId }
    }).promise();

    if (!metadata.Item) {
      return res.status(404).json({ error: 'Stack not found' });
    }

    // Verify ownership
    if (metadata.Item.userId !== user.uid) {
      return res.status(403).json({ error: 'You can only delete your own stacks' });
    }

    // Delete from S3
    await s3.deleteObject({
      Bucket: STACKS_BUCKET,
      Key: metadata.Item.s3Key
    }).promise();

    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: STACKS_TABLE,
      Key: { stackId }
    }).promise();

    res.json({ message: 'Stack deleted successfully' });
  } catch (error) {
    console.error('Error deleting stack:', error);
    res.status(500).json({ error: 'Failed to delete stack' });
  }
}

module.exports = {
  publishStack,
  browseStacks,
  getStack,
  previewStack,
  trackInstall,
  deleteStack
};
```

#### 3. server.js updates
```javascript
// Add to existing server.js
const stacksHandler = require('./src/handlers/stacksHandler');

// Stack routes
app.post('/v1/stacks', stacksHandler.publishStack);
app.get('/v1/stacks', stacksHandler.browseStacks);
app.get('/v1/stacks/:stackId', stacksHandler.getStack);
app.get('/v1/stacks/:stackId/preview', stacksHandler.previewStack);
app.post('/v1/stacks/:stackId/install', stacksHandler.trackInstall);
app.delete('/v1/stacks/:stackId', stacksHandler.deleteStack);
```

### CLI (claude-stacks)

Update src/cli.ts to:
1. Point to real API endpoints instead of placeholders
2. Add `view` command for preview
3. Add `remove` command for deletion
4. Update `list` to support `--mine` flag
5. Update `install-remote` to call install tracking endpoint
6. Update `browse` to show counts

## Deployment Steps

1. **Update template.yaml** with DynamoDB table and S3 bucket
2. **Create stacksHandler.js** with all endpoint handlers
3. **Update server.js** with new routes
4. **Deploy backend** using existing deployment pipeline
5. **Update CLI** to use real endpoints
6. **Test end-to-end** flow
7. **Publish CLI update** to npm

## Success Metrics

Track these metrics to understand usage:
- Number of stacks published per day
- View-to-install conversion rate
- Most popular stacks (by installs)
- Average components per stack
- Public vs private ratio

## Future Enhancements (Post-MVP)

Based on usage patterns, consider adding:
- Stack updates/versioning
- User ratings and reviews
- Advanced search and filtering
- Component-level analytics
- Stack collections/categories
- Fork/remix functionality
- Automated testing of stacks
- Stack templates

## Security Considerations

- Validate stack content size limits (max 5MB)
- Rate limit publishing (5 stacks/hour per user)
- Sanitize markdown in descriptions
- No execution of code during preview
- Firebase auth for all write operations
- Owner-only delete operations

## Timeline

- **Day 1**: Backend implementation (DynamoDB, S3, handlers)
- **Day 2**: CLI updates and testing
- **Day 3**: Deploy and monitor

This MVP provides a complete, functional system that can be expanded based on real user feedback and usage patterns.