/**
 * Reads a single character from user input without requiring Enter key
 *
 * Provides immediate character input for interactive prompts and menus.
 * Handles TTY detection, raw mode management, and special key combinations
 * including Ctrl+C for graceful termination and Enter for empty selection.
 *
 * @param prompt - Text prompt to display to user before reading input
 * @returns Promise resolving to the lowercase character entered by user
 *
 * @example
 * ```typescript
 * // Interactive menu selection
 * const choice = await readSingleChar('Select option (y/n): ');
 * if (choice === 'y') {
 *   console.log('User confirmed');
 * }
 *
 * // Stack deletion confirmation
 * const confirm = await readSingleChar('Delete stack? (y/N): ');
 * if (confirm === 'y') {
 *   await deleteStack(stackId);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function readSingleChar(prompt: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(prompt);

    // Check if raw mode is available (not available when input is piped)
    const supportsRawMode = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';

    if (supportsRawMode) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key: string) => {
      if (supportsRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onData);

      // Handle Ctrl+C
      if (key === '\u0003') {
        // In test environment, resolve with empty string instead of exiting
        if (process.env.NODE_ENV === 'test') {
          process.stdout.write('\n');
          resolve('');
          return;
        }
        process.exit(0);
      }

      // Handle Enter key as empty selection
      if (key === '\r' || key === '\n') {
        process.stdout.write('\n');
        resolve('');
        return;
      }

      // In raw mode, get first character; otherwise get first character of line
      const char = supportsRawMode ? key : key.charAt(0);
      process.stdout.write(supportsRawMode ? '\n' : '');
      resolve(char.toLowerCase());
    };

    process.stdin.on('data', onData);
  });
}
