# Claude Stacks Backend Implementation Plan

## Overview
Build a comprehensive backend system for Claude Stacks on Commands.com that enables users to publish, share, and install complete Claude Code development environments while tracking component popularity.

## 1. Database Schema

### StacksTable
```yaml
TableName: stacks-table
Keys:
  - PK: organizationUsername (HASH)
  - SK: stackId (RANGE)
Attributes:
  - name: String
  - description: String
  - version: String
  - userId: String
  - visibility: String (public/private/unlisted)
  - stats: Map (installs, stars, views)
  - tags: StringSet
  - createdAt: String
  - updatedAt: String
  - publishedAt: String
GSI:
  - userId-createdAt-index (browse user's stacks)
  - visibility-popularity-index (browse public stacks)
  - tag-createdAt-index (search by tags)
```

### StackComponentsTable
```yaml
TableName: stack-components-table
Keys:
  - PK: stackId (HASH)
  - SK: componentType#componentName (RANGE)
Attributes:
  - content: String (deidentified)
  - originalPath: String
  - hash: String (for deduplication)
  - metadata: Map
```

### ComponentAnalyticsTable
```yaml
TableName: component-analytics-table
Keys:
  - PK: componentType#hash (HASH)
  - SK: timestamp (RANGE)
Attributes:
  - usageCount: Number
  - stackIds: StringSet
  - popularityScore: Number
GSI:
  - popularityScore-index (find trending components)
```

## 2. API Endpoints

### Stack Management
- `POST /v1/stacks` - Publish new stack
- `GET /v1/stacks` - Browse public stacks
- `GET /v1/stacks/{stackId}` - Get specific stack
- `PUT /v1/stacks/{stackId}` - Update stack
- `DELETE /v1/stacks/{stackId}` - Delete stack
- `POST /v1/stacks/{stackId}/install` - Track installation

### Analytics Endpoints
- `GET /v1/stacks/trending` - Get trending stacks
- `GET /v1/components/popular` - Get popular components by type
- `GET /v1/stacks/{stackId}/analytics` - Get stack analytics

## 3. Content Deidentification Strategy

### What to Remove
- Local file paths (replace with relative paths)
- User-specific environment variables
- API keys/secrets in content
- Personal information in comments
- Machine-specific configurations

### Implementation
```javascript
function deidentifyContent(content, type) {
  // Remove absolute paths
  content = content.replace(/\/Users\/[^\/]+/g, '~');
  content = content.replace(/\/home\/[^\/]+/g, '~');
  
  // Remove common secrets patterns
  content = content.replace(/api[_-]?key[\s]*=[\s]*["'][^"']+["']/gi, 'API_KEY="***"');
  
  // Standardize paths
  content = content.replace(/\.\.\/\.\.\/[^\/]+/g, '../..');
  
  return content;
}
```

## 4. Component Popularity Tracking

### Tracking System
- Hash each component (command/agent/prompt/MCP) for deduplication
- Track usage across all stacks
- Calculate popularity score: `installs * 0.5 + stars * 0.3 + views * 0.2`
- Update analytics on every stack install

### Popular Components API
```javascript
GET /v1/components/popular?type=command&limit=10
Response: {
  components: [{
    name: "git-workflow",
    description: "Git workflow automation",
    usageCount: 1543,
    stackCount: 89,
    averageRating: 4.8
  }]
}
```

## 5. Backend Implementation

### Express.js Handlers (src/handlers/)
Add to existing App Runner backend:

#### stacksHandler.js
- `POST /v1/stacks` - Validate, deidentify, and store stack
- `GET /v1/stacks` - Browse public stacks with filtering
- `GET /v1/stacks/{stackId}` - Retrieve stack details
- `PUT /v1/stacks/{stackId}` - Update stack (owner only)
- `DELETE /v1/stacks/{stackId}` - Delete stack (owner only)
- `POST /v1/stacks/{stackId}/install` - Track installation

#### analyticsHandler.js
- `GET /v1/stacks/trending` - Get trending stacks
- `GET /v1/components/popular` - Get popular components by type
- `GET /v1/stacks/{stackId}/analytics` - Get stack analytics

### Lambda Functions (Background Tasks Only)

#### updateAnalytics.js
- Process installation events
- Update component popularity scores
- Batch update analytics data
- Triggered by SQS/EventBridge

#### processStackContent.js
- Deep content analysis and validation
- Generate thumbnails/previews
- Long-running content processing tasks

## 6. Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create DynamoDB tables in template.yaml
- [ ] Implement stacksHandler.js for Express routes
- [ ] Add routes to server.js
- [ ] Integrate with existing Firebase auth

### Phase 2: API Development (Week 2)  
- [ ] Implement all CRUD operations for stacks
- [ ] Add stack browsing and search endpoints
- [ ] Implement basic analytics endpoints
- [ ] Test with existing authentication system

### Phase 3: Analytics & Discovery (Week 3)
- [ ] Create Lambda functions for background analytics
- [ ] Implement popularity algorithms
- [ ] Build component tracking system
- [ ] Add search functionality

### Phase 4: CLI Integration (Week 4)
- [ ] Update claude-stacks CLI for new endpoints
- [ ] Add remote install functionality
- [ ] Implement stack versioning
- [ ] Add conflict resolution

### Phase 5: UI & Polish (Week 5)
- [ ] Create web UI for browsing stacks
- [ ] Add stack preview functionality
- [ ] Implement ratings/reviews
- [ ] Performance optimization

## 7. Security Considerations

- Validate all stack content before storage
- Sanitize markdown content for XSS
- Rate limit publishing (5 stacks/hour per user)
- Scan for malicious patterns in commands
- Require authentication for publishing
- Allow anonymous browsing of public stacks

## 8. Integration Points

### With Existing Systems
- Use existing Firebase auth tokens
- Leverage OrganizationsTable for org/user structure
- Reuse content moderation utilities
- Integrate with existing admin tools

### New Capabilities
- Stack versioning system
- Component deduplication engine
- Analytics pipeline for tracking
- Public marketplace discovery

This plan creates a robust backend for Claude Stacks that enables sharing while maintaining security and tracking popularity of components across the ecosystem.