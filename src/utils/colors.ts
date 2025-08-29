import chalk, { Chalk } from 'chalk';

/**
 * Configures chalk instance based on environment variables
 *
 * Respects NO_COLOR and FORCE_COLOR environment variables for accessibility
 * and terminal compatibility.
 *
 * @returns Configured chalk instance
 * @since 1.0.0
 */
const getChalkInstance = () => {
  const forceColor = process.env.FORCE_COLOR;
  const noColor = process.env.NO_COLOR;

  // Disable colors if NO_COLOR is set
  if (noColor) {
    return new Chalk({ level: 0 });
  }
  // Force colors if FORCE_COLOR is set
  else if (forceColor) {
    const level = parseInt(forceColor) || 1;
    return new Chalk({ level: level as 0 | 1 | 2 | 3 });
  }

  return chalk;
};

/**
 * Creates UI styling functions for different content types
 *
 * @param chalkInstance - Configured chalk instance for color application
 * @returns Object containing styled functions for UI elements
 * @since 1.0.0
 */
const createUIStyles = (chalkInstance: ReturnType<typeof getChalkInstance>) => ({
  /**
   * Styles stack names with bright blue bold formatting
   * Used for displaying stack identifiers and titles prominently
   */
  stackName: chalkInstance.blueBright.bold,

  /**
   * Styles component counts with bright green formatting
   * Used for displaying numerical counts of MCP servers, commands, agents, etc.
   */
  componentCount: chalkInstance.greenBright,

  /**
   * Styles author names with yellow formatting
   * Used for displaying stack author information
   */
  author: chalkInstance.yellow,

  /**
   * Styles URLs with cyan underlined formatting
   * Used for displaying clickable or reference URLs
   */
  url: chalkInstance.cyan.underline,

  /**
   * Styles metadata text with dimmed formatting
   * Used for secondary information that should be less prominent
   */
  meta: chalkInstance.dim,

  /**
   * Styles description text with default terminal color
   * Preserves readability by using the terminal's default text color
   */
  description: (text: string) => text,
});

/**
 * Creates status message styling functions
 *
 * @param chalkInstance - Configured chalk instance for color application
 * @returns Object containing styled functions for status messages
 * @since 1.0.0
 */
const createStatusStyles = (chalkInstance: ReturnType<typeof getChalkInstance>) => ({
  /**
   * Styles success messages with green formatting
   * Used for positive status indicators and completion messages
   */
  success: chalkInstance.green,

  /**
   * Styles error messages with red formatting
   * Used for error conditions and failure notifications
   */
  error: chalkInstance.red,

  /**
   * Styles warning messages with yellow formatting
   * Used for cautionary messages and non-critical issues
   */
  warning: chalkInstance.yellow,

  /**
   * Styles informational messages with bright blue formatting
   * Used for general information and status updates
   */
  info: chalkInstance.blueBright,
});

/**
 * Creates utility styling functions for interface elements
 *
 * @param chalkInstance - Configured chalk instance for color application
 * @returns Object containing styled functions for interface elements
 * @since 1.0.0
 */
const createUtilityStyles = (chalkInstance: ReturnType<typeof getChalkInstance>) => ({
  /**
   * Styles bullet points with magenta formatting
   * Used for list markers and visual separators
   */
  bullet: chalkInstance.magenta,

  /**
   * Styles numbers with cyan bold formatting
   * Used for numerical values, indices, and counts in lists
   */
  number: chalkInstance.cyan.bold,

  /**
   * Styles highlighted text with bright magenta formatting
   * Used for emphasis and important text that needs attention
   */
  highlight: chalkInstance.magentaBright,

  /**
   * Styles file paths with gray formatting
   * Used for displaying file system paths in a subdued manner
   */
  path: chalkInstance.gray,

  /**
   * Styles identifiers with gray formatting
   * Used for IDs, keys, and other identifier strings
   */
  id: chalkInstance.gray,
});

/**
 * Creates a color palette optimized for CLI output that works on both light and dark backgrounds
 *
 * The palette respects environment variables NO_COLOR and FORCE_COLOR for accessibility
 * and terminal compatibility. Each color function is designed for specific UI elements
 * to maintain consistent visual hierarchy across the application.
 *
 * @returns Color palette object with themed styling functions for different UI elements
 * @example
 * ```typescript
 * const palette = createColorPalette();
 * console.log(palette.success('Operation completed!'));
 * console.log(palette.stackName('my-awesome-stack'));
 * ```
 * @since 1.0.0
 * @public
 */
const createColorPalette = () => {
  const chalkInstance = getChalkInstance();

  return {
    ...createUIStyles(chalkInstance),
    ...createStatusStyles(chalkInstance),
    ...createUtilityStyles(chalkInstance),
  };
};

/**
 * Pre-configured color palette for consistent CLI styling across the application
 *
 * Provides themed color functions for different types of content including stack names,
 * status messages, file paths, and UI elements. Automatically respects NO_COLOR and
 * FORCE_COLOR environment variables for accessibility compliance.
 *
 * @example
 * ```typescript
 * import { colors } from './colors';
 *
 * console.log(colors.stackName('my-stack'));
 * console.log(colors.success('Installation complete!'));
 * console.log(colors.error('Failed to load configuration'));
 * console.log(colors.info('Fetching from remote...'));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const colors = createColorPalette();
