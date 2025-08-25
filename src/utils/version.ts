import type { DeveloperStack } from '../types/index.js';

export type VersionBumpType = 'major' | 'minor' | 'patch';

/**
 * Parse a semantic version string into components
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected format: X.Y.Z`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Format version components into a semantic version string
 */
export function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);

  if (version1.major !== version2.major) {
    return version1.major > version2.major ? 1 : -1;
  }

  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? 1 : -1;
  }

  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? 1 : -1;
  }

  return 0;
}

/**
 * Bump a version by the specified type
 */
export function bumpVersion(version: string, bumpType: VersionBumpType): string {
  const { major, minor, patch } = parseVersion(version);

  switch (bumpType) {
    case 'major':
      return formatVersion(major + 1, 0, 0);
    case 'minor':
      return formatVersion(major, minor + 1, 0);
    case 'patch':
      return formatVersion(major, minor, patch + 1);
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

/**
 * Validate that a version string is a valid semantic version
 */
export function isValidVersion(version: string): boolean {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the default starting version for new stacks
 */
export function getDefaultVersion(): string {
  return '1.0.0';
}

/**
 * Analyze differences between two stacks and suggest a version bump type
 */
export function suggestVersionBump(
  oldStack: DeveloperStack,
  newStack: DeveloperStack
): VersionBumpType {
  // Check for breaking changes (major version bump)
  if (hasMajorChanges(oldStack, newStack)) {
    return 'major';
  }

  // Check for new features (minor version bump)
  if (hasMinorChanges(oldStack, newStack)) {
    return 'minor';
  }

  // Otherwise, assume patch changes
  return 'patch';
}

/**
 * Check if any MCP servers were removed
 */
function hasMcpServersRemoved(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  const oldMcpServers = new Set(oldStack.mcpServers?.map(s => s.name) ?? []);
  const newMcpServers = new Set(newStack.mcpServers?.map(s => s.name) ?? []);

  for (const oldServer of oldMcpServers) {
    if (!newMcpServers.has(oldServer)) {
      return true; // MCP server removed
    }
  }
  return false;
}

/**
 * Check if any MCP server configurations changed significantly
 */
function hasMcpConfigurationsChanged(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  const oldMcpMap = new Map((oldStack.mcpServers ?? []).map(s => [s.name, s]));
  const newMcpMap = new Map((newStack.mcpServers ?? []).map(s => [s.name, s]));

  for (const [name, oldServer] of oldMcpMap) {
    const newServer = newMcpMap.get(name);
    if (
      newServer &&
      (oldServer.command !== newServer.command ||
        oldServer.type !== newServer.type ||
        JSON.stringify(oldServer.args) !== JSON.stringify(newServer.args))
    ) {
      return true; // MCP server configuration changed significantly
    }
  }
  return false;
}

/**
 * Check if critical settings changed
 */
function haveSettingsChanged(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return JSON.stringify(oldStack.settings) !== JSON.stringify(newStack.settings);
}

/**
 * Check if there are major (breaking) changes between stacks
 */
function hasMajorChanges(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return (
    hasMcpServersRemoved(oldStack, newStack) ||
    hasMcpConfigurationsChanged(oldStack, newStack) ||
    haveSettingsChanged(oldStack, newStack)
  );
}

/**
 * Get component count safely
 */
function getComponentCount(components: unknown[] | undefined): number {
  return components?.length ?? 0;
}

/**
 * Check if commands count increased
 */
function commandsIncreased(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return getComponentCount(newStack.commands) > getComponentCount(oldStack.commands);
}

/**
 * Check if agents count increased
 */
function agentsIncreased(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return getComponentCount(newStack.agents) > getComponentCount(oldStack.agents);
}

/**
 * Check if MCP servers count increased
 */
function mcpServersIncreased(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return getComponentCount(newStack.mcpServers) > getComponentCount(oldStack.mcpServers);
}

/**
 * Check if component counts increased
 */
function haveComponentCountsIncreased(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return (
    commandsIncreased(oldStack, newStack) ||
    agentsIncreased(oldStack, newStack) ||
    mcpServersIncreased(oldStack, newStack)
  );
}

/**
 * Check if new commands were added
 */
function haveNewCommandsBeenAdded(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  const oldCommandNames = new Set((oldStack.commands ?? []).map(c => c.name));
  const newCommandNames = new Set((newStack.commands ?? []).map(c => c.name));

  for (const name of newCommandNames) {
    if (!oldCommandNames.has(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if new agents were added
 */
function haveNewAgentsBeenAdded(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  const oldAgentNames = new Set((oldStack.agents ?? []).map(a => a.name));
  const newAgentNames = new Set((newStack.agents ?? []).map(a => a.name));

  for (const name of newAgentNames) {
    if (!oldAgentNames.has(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if there are minor (feature addition) changes between stacks
 */
function hasMinorChanges(oldStack: DeveloperStack, newStack: DeveloperStack): boolean {
  return (
    haveComponentCountsIncreased(oldStack, newStack) ||
    haveNewCommandsBeenAdded(oldStack, newStack) ||
    haveNewAgentsBeenAdded(oldStack, newStack)
  );
}

/**
 * Generate a suggested version based on the previous version and detected changes
 */
export function generateSuggestedVersion(
  previousVersion: string | null,
  oldStack?: DeveloperStack,
  newStack?: DeveloperStack
): string {
  if (!previousVersion) {
    return getDefaultVersion();
  }

  if (oldStack && newStack) {
    const bumpType = suggestVersionBump(oldStack, newStack);
    return bumpVersion(previousVersion, bumpType);
  }

  // Default to patch bump if we can't analyze changes
  return bumpVersion(previousVersion, 'patch');
}
