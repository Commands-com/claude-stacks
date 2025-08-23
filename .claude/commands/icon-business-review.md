---
name: "Icon Business Review"
description: "Intelligent business analysis that automatically selects the most relevant legendary business strategists for your project and market challenges"
author: "Icon Business Strategists"
version: "1.0.0"
category: "business"
tags: ["business", "strategy", "analysis", "legendary", "experts"]
allowed-tools: Task(clayton-christensen:*), Task(michael-porter:*), Task(eric-ries:*), Task(steve-jobs:*), Task(jeff-bezos:*), Task(peter-drucker:*), Task(reid-hoffman:*), Task(elon-musk:*), Read, Glob, Grep
---

# Icon Business Review

Intelligent business analysis that automatically selects the most relevant legendary business strategists based on your project's business model, market position, and strategic challenges. Executes selected experts in parallel for comprehensive business assessment.

## Available Business Strategists

**8 Legendary Business Experts:**
- **Clayton Christensen**: Disruptive innovation theory, market analysis, competitive dynamics
- **Michael Porter**: Competitive strategy, Five Forces analysis, value chain optimization
- **Eric Ries**: Lean startup methodology, build-measure-learn cycles, validated learning
- **Steve Jobs**: Product vision, design excellence, market-creating innovation
- **Jeff Bezos**: Customer obsession, long-term thinking, operational excellence
- **Peter Drucker**: Management effectiveness, knowledge work optimization, organizational design
- **Reid Hoffman**: Network effects, platform strategy, ecosystem building
- **Elon Musk**: First principles thinking, vertical integration, breakthrough engineering

## Business Analysis Process

### 1. **Gather Git Context**
- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

### 2. **Business Context Gathering**

I'll analyze your project for business characteristics:

**Business Model Analysis:**
- Revenue model and monetization strategy
- Customer segments and value propositions
- Market positioning and competitive landscape
- Growth strategy and scaling approach

**Product Strategy Analysis:**
- Product-market fit indicators
- Feature prioritization and roadmap
- User acquisition and retention strategies
- Innovation and differentiation opportunities

### 3. **Intelligent Business Expert Selection**

Based on project analysis, I'll select 2-4 most relevant business experts:

**Selection Criteria:**
- **Startup/Innovation** → Eric Ries + Clayton Christensen
- **Competitive Strategy** → Michael Porter + Jeff Bezos
- **Product Vision** → Steve Jobs + Peter Drucker
- **Platform/Network Effects** → Reid Hoffman + Jeff Bezos
- **Disruptive Innovation** → Clayton Christensen + Elon Musk
- **Customer-Centric Growth** → Jeff Bezos + Eric Ries
- **Manufacturing/Engineering** → Elon Musk + Steve Jobs

### 4. **Parallel Business Expert Execution**

Selected experts analyze simultaneously:

```
<function_calls>
<invoke name="Task">
<parameter name="subagent_type">[selected-business-expert-1]</parameter>
<parameter name="description">[Expert] business analysis</parameter>
<parameter name="prompt">Analyze this project from your business strategy perspective.

Project Context:
[PROJECT_BUSINESS_MODEL_AND_STRATEGY]

Market Context:
[COMPETITIVE_LANDSCAPE_AND_POSITIONING]

Focus on your core business expertise:
[EXPERT_SPECIFIC_BUSINESS_FOCUS]

Provide business analysis with concrete, actionable strategic recommendations.</parameter>
</invoke>
[Additional business experts in parallel...]
</function_calls>
```

<function_results>
[Business expert analyses will appear here when executed]
</function_results>

## Expected Business Review Output

```
# 💼 ICON BUSINESS REVIEW

## Overall Business Assessment: [STRONG STRATEGY / GOOD DIRECTION / NEEDS REFINEMENT / MAJOR PIVOT REQUIRED]

## Business Expert Analysis

### [Selected Business Expert 1]: [Strategy Score]
**Focus Area**: [Innovation/Competition/Customer/etc.]
**Key Findings**:
- [Specific business observations]
**Recommendations**:
- [Actionable strategic improvements]

### [Selected Business Expert 2]: [Strategy Score]
**Focus Area**: [Different business domain]
**Key Findings**:
- [Additional strategic insights]
**Recommendations**:
- [Complementary business strategies]

## Unified Business Recommendations

### 🚨 Critical Business Issues
- [Fundamental business model or strategy problems]

### ⚡ Strategic Quick Wins
- [High-impact, achievable business improvements]

### 🏗️ Long-term Strategic Vision
- [Major strategic initiatives and transformations]

### 💰 Revenue & Growth Opportunities
- [Monetization and scaling strategies]

## Market Position & Competitive Analysis
- [Competitive positioning recommendations]
- [Market opportunity assessment]
- [Differentiation strategy suggestions]

## Business Model Optimization
- [Revenue model improvements]
- [Cost structure optimization]
- [Value creation enhancement]
```

## Common Business Focus Areas

**Strategy & Innovation:**
- Disruptive innovation opportunities
- Competitive differentiation strategies
- Market entry and expansion plans
- Innovation pipeline management

**Operations & Growth:**
- Scaling strategies and operational excellence
- Customer acquisition and retention
- Revenue optimization and monetization
- Organizational design and management

**Product & Market:**
- Product-market fit validation
- Customer development and segmentation
- Value proposition refinement
- Go-to-market strategy optimization

This command provides focused business expertise from the legendary business pod, automatically selecting the most relevant strategists for your specific business challenges and market opportunities.