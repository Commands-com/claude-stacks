import * as path from 'path';
import * as os from 'os';

/**
 * Central configuration for all file paths used by Claude Stacks CLI
 */
export const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude');
export const STACKS_PATH = path.join(CLAUDE_CONFIG_PATH, 'stacks');
export const CONFIG_FILE = path.join(CLAUDE_CONFIG_PATH, 'config.json');

/**
 * Get the path to a specific stack directory
 */
export function getStackPath(stackName: string): string {
  return path.join(STACKS_PATH, stackName);
}

/**
 * Get the path to a stack's metadata file
 */
export function getStackMetadataPath(stackName: string): string {
  return path.join(getStackPath(stackName), 'stack.json');
}

/**
 * Get the path to a stack's files directory
 */
export function getStackFilesPath(stackName: string): string {
  return path.join(getStackPath(stackName), 'files');
}
