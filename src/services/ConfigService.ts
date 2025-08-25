import type { StackConfig } from '../types/index.js';
import { ConfigurationError, ValidationError } from '../types/index.js';
import { FileService } from './FileService.js';

/**
 * Service for handling configuration validation and management
 */
export class ConfigService {
  private readonly fileService: FileService;

  constructor(fileService?: FileService) {
    this.fileService = fileService ?? new FileService();
  }

  /**
   * Validate stack name format
   */
  validateStackName(name: unknown): asserts name is string {
    if (typeof name !== 'string') {
      throw new ValidationError('name', name, 'string');
    }

    if (name.length === 0) {
      throw new ValidationError('name', name, 'non-empty string');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      throw new ValidationError('name', name, 'string without invalid characters (<>:"/\\|?*)');
    }

    // Check length constraints
    if (name.length > 100) {
      throw new ValidationError('name', name, 'string with less than 100 characters');
    }
  }

  /**
   * Validate semantic version format
   */
  validateVersion(version: unknown): asserts version is string {
    if (typeof version !== 'string') {
      throw new ValidationError('version', version, 'string');
    }

    const semverRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    if (!semverRegex.test(version)) {
      throw new ValidationError('version', version, 'semantic version format (e.g., 1.0.0)');
    }
  }

  /**
   * Validate and parse stack configuration
   */
  validateStackConfig(data: unknown): StackConfig {
    if (typeof data !== 'object' || data === null) {
      throw new ValidationError('config', data, 'object');
    }

    const config = data as Record<string, unknown>;

    this.validateStackName(config.name);
    this.validateVersion(config.version);

    const validatedConfig: StackConfig = {
      name: config.name,
      version: config.version,
      dependencies: [],
    };

    this.validateOptionalDescription(config, validatedConfig);
    this.validateOptionalAuthor(config, validatedConfig);
    this.validateOptionalDependencies(config, validatedConfig);
    this.validateOptionalScripts(config, validatedConfig);
    this.validateOptionalSettings(config, validatedConfig);

    return validatedConfig;
  }

  private validateOptionalDescription(
    config: Record<string, unknown>,
    validatedConfig: StackConfig
  ): void {
    if (config.description !== undefined) {
      if (typeof config.description !== 'string') {
        throw new ValidationError('description', config.description, 'string');
      }
      validatedConfig.description = config.description;
    }
  }

  private validateOptionalAuthor(
    config: Record<string, unknown>,
    validatedConfig: StackConfig
  ): void {
    if (config.author !== undefined) {
      if (typeof config.author !== 'string') {
        throw new ValidationError('author', config.author, 'string');
      }
      validatedConfig.author = config.author;
    }
  }

  private validateOptionalDependencies(
    config: Record<string, unknown>,
    validatedConfig: StackConfig
  ): void {
    if (config.dependencies !== undefined) {
      if (!Array.isArray(config.dependencies)) {
        throw new ValidationError('dependencies', config.dependencies, 'array');
      }

      for (const dep of config.dependencies) {
        if (typeof dep !== 'string') {
          throw new ValidationError('dependency', dep, 'string');
        }
      }
      validatedConfig.dependencies = config.dependencies as string[];
    }
  }

  private validateOptionalScripts(
    config: Record<string, unknown>,
    validatedConfig: StackConfig
  ): void {
    if (config.scripts !== undefined) {
      if (
        typeof config.scripts !== 'object' ||
        config.scripts === null ||
        Array.isArray(config.scripts)
      ) {
        throw new ValidationError('scripts', config.scripts, 'object');
      }

      const scripts = config.scripts as Record<string, unknown>;
      const validatedScripts: Record<string, string> = {};

      for (const [key, value] of Object.entries(scripts)) {
        if (typeof value !== 'string') {
          throw new ValidationError(`script.${key}`, value, 'string');
        }
        validatedScripts[key] = value;
      }
      validatedConfig.scripts = validatedScripts;
    }
  }

  private validateOptionalSettings(
    config: Record<string, unknown>,
    validatedConfig: StackConfig
  ): void {
    if (config.settings !== undefined) {
      if (
        typeof config.settings !== 'object' ||
        config.settings === null ||
        Array.isArray(config.settings)
      ) {
        throw new ValidationError('settings', config.settings, 'object');
      }
      validatedConfig.settings = config.settings as Record<string, unknown>;
    }
  }

  /**
   * Load and validate configuration from file
   */
  async loadConfig(configPath: string): Promise<StackConfig> {
    try {
      const data = await this.fileService.readJsonFile(configPath);
      return this.validateStackConfig(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ConfigurationError(`Invalid configuration: ${error.message}`, error);
      }
      throw error;
    }
  }

  /**
   * Save validated configuration to file
   */
  async saveConfig(configPath: string, config: StackConfig): Promise<void> {
    try {
      this.validateStackConfig(config);
      await this.fileService.writeJsonFile(configPath, config);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ConfigurationError(`Cannot save invalid configuration: ${error.message}`, error);
      }
      throw error;
    }
  }

  /**
   * Create default configuration
   */
  createDefaultConfig(name: string, version: string = '1.0.0'): StackConfig {
    this.validateStackName(name);
    this.validateVersion(version);

    return {
      name,
      version,
      dependencies: [],
      description: `Development stack for ${name}`,
    };
  }

  /**
   * Type guard to check if an object is a valid StackConfig
   */
  isValidStackConfig(data: unknown): data is StackConfig {
    try {
      this.validateStackConfig(data);
      return true;
    } catch {
      return false;
    }
  }
}
