import chalk, { Chalk } from 'chalk';

// Color palette that works on both light and dark backgrounds
const createColorPalette = () => {
  // Honor NO_COLOR and FORCE_COLOR environment variables
  const forceColor = process.env.FORCE_COLOR;
  const noColor = process.env.NO_COLOR;
  const themeOverride = process.env.CLAUDE_STACKS_THEME;
  
  let chalkInstance = chalk;
  
  // Disable colors if NO_COLOR is set
  if (noColor) {
    chalkInstance = new Chalk({ level: 0 });
  }
  // Force colors if FORCE_COLOR is set
  else if (forceColor) {
    const level = parseInt(forceColor) || 1;
    chalkInstance = new Chalk({ level: level as any });
  }
  
  return {
    // Primary elements - bright variants for better contrast
    stackName: chalkInstance.blueBright.bold,
    componentCount: chalkInstance.greenBright,
    author: chalkInstance.yellow,
    url: chalkInstance.cyan.underline,
    
    // Secondary elements - use dim for truly secondary info, default color for descriptions
    // Note: CLAUDE_STACKS_THEME override is preserved but not used in favor of universal colors
    meta: chalkInstance.dim,
    description: (text: string) => text, // Use default terminal color for readability
    
    // Status and emphasis
    success: chalkInstance.green,
    error: chalkInstance.red,
    warning: chalkInstance.yellow,
    info: chalkInstance.blueBright,
    
    // UI elements
    bullet: chalkInstance.magenta,
    number: chalkInstance.cyan.bold,
    highlight: chalkInstance.magentaBright,
    
    // File paths and IDs
    path: chalkInstance.gray,
    id: chalkInstance.gray,
  };
};

export const colors = createColorPalette();