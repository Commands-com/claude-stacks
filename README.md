# Commands.com Setup CLI

Bootstrap CLI for Commands.com ecosystem. One command to install the MCP server and set up intelligent project tooling.

## Quick Start

```bash
# Bootstrap everything
npx commands-setup

# Now you can use project setup anywhere
cd ~/my-project
claude --prompt "/setup-project"
```

## What it does

### 1. `npx commands-setup`
- Installs Commands.com MCP server
- Creates global `/setup-project` command in `~/.claude/commands/`
- Sets up the `commands` CLI tool

### 2. `/setup-project` (global command)
- Analyzes current project directory
- Gets AI-powered tool recommendations
- Shows install options with explanations
- Installs selected tools

### 3. `commands` CLI
```bash
# Install specific tools
commands install command ap_dev/sentiment-analyzer
commands install agent commands-com/backend-architect
commands install prompt user123/react-optimizer

# List installed tools
commands list
```

## User Workflow

1. **One-time setup**:
   ```bash
   npx commands-setup
   ```

2. **Use in any project**:
   ```bash
   cd ~/my-react-app
   claude --prompt "/setup-project"
   ```

3. **Get recommendations**:
   ```
   🔍 PROJECT ANALYSIS COMPLETE
   
   📊 Detected: React + TypeScript + Stripe
   🎯 Recommendations:
   
   ## Essential Security (Required for payments)
   - Bruce Schneier Agent - Security expert
   - Security Audit Command - Vulnerability scanning  
   - Stripe MCP - Payment integration
   
   Install essential tools? (y/n)
   ```

4. **Tools get installed automatically**:
   ```bash
   commands install agent commands-com/bruce-schneier
   commands install command security/audit
   claude mcp add stripe -- docker run -i --rm mcp/stripe:latest
   ```

## Architecture

- **Bootstrap**: `npx commands-setup` (one-time)
- **Global Command**: `~/.claude/commands/setup-project.md`
- **MCP Integration**: Uses Commands.com MCP for recommendations
- **CLI Tool**: `commands install` for asset management

## Benefits

✅ **One-time setup**: `npx commands-setup`  
✅ **Works anywhere**: `claude --prompt "/setup-project"` in any directory  
✅ **Intelligent**: AI-powered recommendations  
✅ **Interactive**: User approves before installing  
✅ **Namespaced**: Proper `user/tool-name` format  
✅ **Mixed installs**: MCP servers + Commands/Agents  

## Development

```bash
npm install
npm run build
npm run dev  # Test locally
```

## Publishing

```bash
npm publish
```

Then users can run:
```bash
npx commands-setup
```