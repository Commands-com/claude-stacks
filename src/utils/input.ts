// Utility function for single character input without Enter
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
