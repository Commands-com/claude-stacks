import { colors } from '../utils/colors.js';
import { readSingleChar } from '../utils/input.js';

/**
 * Service for user interface operations including colored output and user input
 *
 * @remarks
 * Encapsulates all UI utilities to reduce coupling in action layer.
 * Provides consistent interface for console output and user interaction.
 *
 * @since 1.2.3
 * @public
 */
export class UIService {
  /**
   * Display an informational message
   */
  info(message: string): void {
    console.log(colors.info(message));
  }

  /**
   * Display an error message
   */
  error(message: string, details?: string): void {
    if (details) {
      console.error(colors.error(message), details);
    } else {
      console.error(colors.error(message));
    }
  }

  /**
   * Display a success message
   */
  success(message: string): void {
    console.log(colors.success(message));
  }

  /**
   * Display a warning message
   */
  warning(message: string): void {
    console.log(colors.warning(message));
  }

  /**
   * Display metadata/secondary information
   */
  meta(message: string): void {
    console.log(colors.meta(message));
  }

  /**
   * Display a stack name with appropriate styling
   */
  stackName(name: string): void {
    console.log(colors.stackName(name));
  }

  /**
   * Display a description with appropriate styling
   */
  description(text: string): void {
    console.log(colors.description(text));
  }

  /**
   * Display highlighted text
   */
  highlight(text: string): void {
    console.log(colors.highlight(text));
  }

  /**
   * Display a number with appropriate styling
   */
  number(value: string | number): void {
    console.log(colors.number(String(value)));
  }

  /**
   * Log a plain message without styling
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Read a single character from user input
   */
  async readSingleChar(prompt: string): Promise<string> {
    return await readSingleChar(prompt);
  }

  /**
   * Read multiple lines from user input
   * Note: This is a placeholder implementation
   */
  async readMultipleLines(prompt: string): Promise<string[]> {
    // For now, just return empty array - can be implemented later if needed
    console.log(prompt);
    return [];
  }

  /**
   * Display a colored stack name inline (returns string for composition)
   */
  colorStackName(name: string): string {
    return colors.stackName(name);
  }

  /**
   * Display colored description inline (returns string for composition)
   */
  colorDescription(text: string): string {
    return colors.description(text);
  }

  /**
   * Display colored info inline (returns string for composition)
   */
  colorInfo(text: string): string {
    return colors.info(text);
  }

  /**
   * Display colored meta inline (returns string for composition)
   */
  colorMeta(text: string): string {
    return colors.meta(text);
  }

  /**
   * Display colored error inline (returns string for composition)
   */
  colorError(text: string): string {
    return colors.error(text);
  }

  /**
   * Display colored success inline (returns string for composition)
   */
  colorSuccess(text: string): string {
    return colors.success(text);
  }

  /**
   * Display colored warning inline (returns string for composition)
   */
  colorWarning(text: string): string {
    return colors.warning(text);
  }

  /**
   * Display colored highlight inline (returns string for composition)
   */
  colorHighlight(text: string): string {
    return colors.highlight(text);
  }

  /**
   * Display colored number inline (returns string for composition)
   */
  colorNumber(value: string | number): string {
    return colors.number(String(value));
  }
}
