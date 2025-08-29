import {
  type MissingDependency,
  checkMcpDependencies,
  checkStatusLineDependencies,
  displayMissingDependencies,
} from '../utils/dependencies.js';
import type { StackMcpServer } from '../types/index.js';

/**
 * Service for dependency checking and validation
 *
 * @remarks
 * Encapsulates dependency utilities to reduce coupling in action layer.
 * Provides a clean interface for checking MCP server dependencies
 * and displaying missing dependency information to users.
 *
 * @since 1.2.3
 * @public
 */
export class DependencyService {
  /**
   * Check for missing MCP server dependencies
   *
   * @param mcpServers - Array of MCP server configurations to check
   * @returns Promise that resolves to array of missing dependencies
   */
  async checkMcpDependencies(mcpServers: StackMcpServer[]): Promise<MissingDependency[]> {
    return await checkMcpDependencies(mcpServers);
  }

  /**
   * Check for missing statusLine dependencies
   *
   * @param statusLine - StatusLine configuration to check
   * @returns Promise that resolves to array of missing dependencies
   */
  async checkStatusLineDependencies(statusLine?: {
    type?: string;
    command?: string;
  }): Promise<MissingDependency[]> {
    return await checkStatusLineDependencies(statusLine);
  }

  /**
   * Display missing dependencies to the user with appropriate formatting
   *
   * @param missingDeps - Array of missing dependencies to display
   */
  displayMissingDependencies(missingDeps: MissingDependency[]): void {
    displayMissingDependencies(missingDeps);
  }

  /**
   * Check dependencies and display them if any are missing
   *
   * @param mcpServers - Array of MCP server configurations to check
   * @returns Promise that resolves to true if all dependencies are satisfied
   */
  async checkAndDisplayMissingDependencies(mcpServers: StackMcpServer[]): Promise<boolean> {
    const missingDeps = await this.checkMcpDependencies(mcpServers);

    if (missingDeps.length > 0) {
      this.displayMissingDependencies(missingDeps);
      return false;
    }

    return true;
  }

  /**
   * Get a summary of dependency check results
   *
   * @param mcpServers - Array of MCP server configurations to check
   * @returns Promise that resolves to dependency summary
   */
  /**
   * Get a comprehensive summary of dependency check results for MCP servers
   *
   * @remarks
   * Analyzes all provided MCP server configurations and returns a detailed summary
   * including counts of total, missing, and satisfied dependencies. This method
   * provides both statistical overview and specific missing dependency details
   * for comprehensive dependency validation reporting.
   *
   * @param mcpServers - Array of MCP server configurations to check for dependencies
   * @returns Promise that resolves to a dependency summary object containing:
   * - `total`: Total number of MCP servers being checked
   * - `missing`: Number of MCP servers with missing dependencies
   * - `satisfied`: Number of MCP servers with all dependencies satisfied
   * - `missingDependencies`: Array of detailed missing dependency objects with installation instructions
   * @throws Error if dependency checking fails due to system issues
   * @example
   * ```typescript
   * const dependencyService = new DependencyService();
   * const mcpServers = [
   *   { name: 'filesystem', command: 'mcp-server-filesystem' },
   *   { name: 'postgres', command: 'mcp-server-postgres' }
   * ];
   *
   * const summary = await dependencyService.getDependencySummary(mcpServers);
   * console.log(`Total: ${summary.total}, Missing: ${summary.missing}`);
   * // Output: Total: 2, Missing: 1
   *
   * if (summary.missingDependencies.length > 0) {
   *   console.log('Missing dependencies:', summary.missingDependencies.map(dep => dep.command));
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async getDependencySummary(mcpServers: StackMcpServer[]): Promise<{
    /** Total number of MCP servers being checked for dependencies */
    total: number;
    /** Number of MCP servers that have missing dependencies */
    missing: number;
    /** Number of MCP servers with all dependencies satisfied (total - missing) */
    satisfied: number;
    /** Array of detailed missing dependency objects containing command names, types, and installation instructions */
    missingDependencies: MissingDependency[];
  }> {
    const missingDeps = await this.checkMcpDependencies(mcpServers);

    return {
      total: mcpServers.length,
      missing: missingDeps.length,
      satisfied: mcpServers.length - missingDeps.length,
      missingDependencies: missingDeps,
    };
  }

  /**
   * Check if all dependencies are satisfied without displaying results
   *
   * @param mcpServers - Array of MCP server configurations to check
   * @returns Promise that resolves to true if all dependencies are satisfied
   */
  async areAllDependenciesSatisfied(mcpServers: StackMcpServer[]): Promise<boolean> {
    const missingDeps = await this.checkMcpDependencies(mcpServers);
    return missingDeps.length === 0;
  }

  /**
   * Get missing dependency names only
   *
   * @param mcpServers - Array of MCP server configurations to check
   * @returns Promise that resolves to array of missing dependency names
   */
  async getMissingDependencyNames(mcpServers: StackMcpServer[]): Promise<string[]> {
    const missingDeps = await this.checkMcpDependencies(mcpServers);
    return missingDeps.map(dep => dep.command);
  }
}
