---
name: "Icon Review"
description: "Intelligent project and code analysis that automatically selects the most relevant legendary experts across all domains based on your codebase and changes"
author: "Icon Expert System"
version: "2.0.0"
category: "review"
tags: ["analysis", "review", "legendary", "experts", "multi-domain"]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(find:*), Bash(ls:*), Read, Glob, Grep
---

# Icon Review - Legendary Multi-Domain Analysis

Intelligent project and code analysis that automatically selects the most relevant legendary experts across all 8 domains (Programming, Data/AI, Product/Policy, Business, Design, Platform/Operations, Security, Healthcare) based on your codebase and changes.

## Analysis Process

### 1. **Project Context Gathering**

I'll analyze your project comprehensively:

**Project Structure & Technology Stack:**
- Repository structure: !`find . -type f -name "*.md" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "package.json" -o -name "requirements.txt" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pom.xml" | head -20`
- Main languages: !`find . -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" | head -10`
- Configuration files: !`ls -la | grep -E "\.(env|config|conf)" || echo "No configuration files found"`

**Git Context (if available):**
- Current git status: !`git status`
- Recent changes: !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

**Project README/Documentation:**
- README content for context understanding

### 2. **Intelligent Domain Detection**

Based on the analysis, I'll identify relevant domains and suggest expert pods:

**Available Expert Domains:**
- **Programming**: 8 legendary programmers (Linus, Carmack, Hickey, Knuth, Kay, Beck, Lamport, Liskov)
- **Data & AI**: 8 AI/ML pioneers (Ng, Li, Hinton, Mason, LeCun, Kozyrkov, Patil, Thrun)  
- **Product & Policy**: 8 product leaders (Cagan, Kim, Bryson, Zatlyn, Zhuo, Horowitz, Harris, O'Neil)
- **Business**: 8 strategy experts (Christensen, Porter, Ries, Jobs, Bezos, Drucker, Hoffman, Musk)
- **Design**: 8 design masters (Rams, Norman, Tufte, Ive, Kare, Nielsen, Holmes, Downe)
- **Platform & Operations**: 8 infrastructure experts (Berners-Lee, Cerf, Perlman, Vogels, Fowler, Gregg, Hightower, Frazelle)
- **Security**: 8 security experts (Kaminsky, Moussouris, Schneier, Hyppönen, Wheeler, Zatko, Galperin, Marlinspike)
- **Healthcare**: 8 healthcare luminaries (Gawande, Topol, Barzilay, Koller, Wachter, Li, Ng, Khosla)

### 3. **Expert Selection & User Guidance**

After analyzing your project, I'll:

1. **Suggest relevant domains** based on project characteristics
2. **Recommend specific experts** within those domains
3. **Ask for your focus areas** or confirm suggested approach
4. **Execute selected experts in parallel** for comprehensive analysis

**Example Selection Logic:**
- Web application with React → Programming + Design + Security
- Machine learning project → Programming + Data/AI  
- Healthcare AI business plan → Healthcare + Business + Data/AI
- Medical imaging AI → Healthcare + Data/AI + Programming
- Startup pitch deck → Business + Design + Product/Policy
- Infrastructure automation → Platform/Operations + Security + Programming
- API design → Programming + Platform/Operations + Design

### 4. **Guided Expert Selection**

I'll present recommendations like:

```
🔍 PROJECT ANALYSIS COMPLETE

📊 Detected Technologies: [React, TypeScript, Node.js, Docker]
🎯 Suggested Focus Areas: Programming, Platform/Operations, Security

💡 RECOMMENDED EXPERT PANELS:

🏆 COMPREHENSIVE (6 experts):
  Programming: Linus Torvalds, Rich Hickey  
  Platform: Werner Vogels, Kelsey Hightower
  Security: Bruce Schneier, Jessie Frazelle

⚡ FOCUSED (3 experts):
  Programming: Linus Torvalds
  Platform: Werner Vogels  
  Security: Bruce Schneier

🎯 CUSTOM: Select specific domains and experts

Which approach would you prefer? Or would you like to:
- Focus on specific git changes only?
- Review specific files/directories?
- Target particular concerns (performance, security, architecture)?
```

### 5. **Parallel Multi-Domain Execution**

After selection, I'll execute chosen experts simultaneously:

```
<function_calls>
<invoke name="Task">
<parameter name="subagent_type">[selected-expert-1]</parameter>
<parameter name="description">[Expert] project analysis</parameter>
<parameter name="prompt">Analyze this project from your [domain] expertise perspective.

Project Context:
[PROJECT_STRUCTURE_AND_TECH_STACK]

Git Changes (if applicable):
[GIT_DIFF_AND_STATUS]

Focus on your core expertise:
[EXPERT_SPECIFIC_FOCUS_AREAS]

Provide analysis with concrete, actionable recommendations.</parameter>
</invoke>
<invoke name="Task">
<parameter name="subagent_type">[selected-expert-2]</parameter>
[Additional experts in parallel...]
</invoke>
</function_calls>
```

**Benefits of Multi-Domain Parallel Execution:**
- **Comprehensive**: Multiple expert perspectives across domains
- **Fast**: Parallel execution (up to 8x faster than sequential)
- **Targeted**: Only relevant experts for your specific project
- **Cross-Domain**: Identifies interactions between domains (e.g., security implications of architectural decisions)

<function_results>
[Multi-domain expert analyses will appear here when executed]
</function_results>

## Expected Output Format

After parallel execution, analysis will be synthesized:

```
# 🏆 ICON MULTI-DOMAIN REVIEW

## Overall Project Assessment: [EXCELLENT / GOOD / NEEDS IMPROVEMENT / MAJOR ISSUES]

## Cross-Domain Analysis Summary

### Programming Excellence
**[Selected Programming Expert]**: [Score/Assessment]
[Key findings and recommendations]

### [Additional Domain 1]  
**[Selected Expert]**: [Score/Assessment]
[Key findings and recommendations]

### [Additional Domain 2]
**[Selected Expert]**: [Score/Assessment]  
[Key findings and recommendations]

## Unified Recommendations

### 🚨 Critical Issues (Cross-Domain Impact)
- [Issues that affect multiple domains]

### ⚡ Quick Wins (High Impact, Low Effort)
- [Improvements across domains]

### 🏗️ Strategic Improvements (Long-term)
- [Architectural and strategic recommendations]

### 🎯 Domain-Specific Actions
- **Programming**: [Specific technical improvements]
- **Security**: [Security enhancements]
- **Design**: [UX/design improvements]
- [Other relevant domains]
```

## Usage Examples

**Project Review:**
- General project assessment and improvement recommendations
- Technology stack evaluation and modernization advice
- Cross-domain analysis (security + performance + design)

**Commit Review:**
- Focused analysis of specific changes
- Pre-commit quality gates
- Impact assessment across domains

**Strategic Review:**
- Business + technical alignment
- Product strategy + implementation feasibility
- Market positioning + technical capabilities

**Focus Areas:**
- Performance optimization (Carmack + Gregg + Vogels)
- Security hardening (Security pod + Platform experts)  
- User experience (Design pod + Product experts)
- Scalability planning (Platform + Business + Programming)

## Expert Pod Shortcuts

For direct domain access, use specialized commands:
- `/icon-programming-review` - Programming domain only
- `/icon-security-review` - Security domain only  
- `/icon-design-review` - Design domain only
- `/icon-business-review` - Business domain only
- `/icon-data-ai-review` - Data & AI domain only
- `/icon-product-policy-review` - Product & Policy domain only
- `/icon-platform-operations-review` - Platform & Operations domain only