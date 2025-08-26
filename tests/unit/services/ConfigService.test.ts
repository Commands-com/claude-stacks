import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigService } from '../../../src/services/ConfigService.js';
import { FileService } from '../../../src/services/FileService.js';
import { ValidationError, ConfigurationError } from '../../../src/types/errors.js';
import type { StackConfig } from '../../../src/types/stack.js';

// Mock FileService
jest.mock('../../../src/services/FileService.js');
const MockedFileService = FileService as jest.MockedClass<typeof FileService>;

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockFileService: jest.Mocked<FileService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileService = new MockedFileService() as jest.Mocked<FileService>;
    configService = new ConfigService(mockFileService);
  });

  describe('constructor', () => {
    it('should create instance with provided FileService', () => {
      const service = new ConfigService(mockFileService);
      expect(service).toBeInstanceOf(ConfigService);
    });

    it('should create instance with default FileService when none provided', () => {
      const service = new ConfigService();
      expect(service).toBeInstanceOf(ConfigService);
    });
  });

  describe('validateStackName', () => {
    it('should accept valid stack names', () => {
      const validNames = ['my-stack', 'MyStack', 'stack123', 'my_stack', 'a'];

      validNames.forEach(name => {
        expect(() => configService.validateStackName(name)).not.toThrow();
      });
    });

    it('should throw ValidationError for non-string names', () => {
      const invalidTypes = [null, undefined, 123, true, {}, []];

      invalidTypes.forEach(name => {
        expect(() => configService.validateStackName(name)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => configService.validateStackName('')).toThrow(ValidationError);
    });

    it('should throw ValidationError for names with invalid characters', () => {
      const invalidNames = [
        'stack<test>',
        'stack>test',
        'stack:test',
        'stack"test',
        'stack/test',
        'stack\\test',
        'stack|test',
        'stack?test',
        'stack*test',
      ];

      invalidNames.forEach(name => {
        expect(() => configService.validateStackName(name)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError for names exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => configService.validateStackName(longName)).toThrow(ValidationError);
    });

    it('should accept names with exactly 100 characters', () => {
      const maxName = 'a'.repeat(100);
      expect(() => configService.validateStackName(maxName)).not.toThrow();
    });
  });

  describe('validateVersion', () => {
    it('should accept valid semantic versions', () => {
      const validVersions = [
        '1.0.0',
        '0.0.1',
        '10.20.30',
        '1.1.2-alpha',
        '1.0.0-beta.1',
        '2.0.0-rc.1+build.1',
        '1.2.3+build.123',
      ];

      validVersions.forEach(version => {
        expect(() => configService.validateVersion(version)).not.toThrow();
      });
    });

    it('should throw ValidationError for non-string versions', () => {
      const invalidTypes = [null, undefined, 123, true, {}, []];

      invalidTypes.forEach(version => {
        expect(() => configService.validateVersion(version)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError for invalid semantic versions', () => {
      const invalidVersions = [
        '1.0',
        '1',
        'v1.0.0',
        '1.0.0.0',
        'latest',
        'alpha',
        '1.0.0-',
        '1.0.0+',
        '01.0.0',
        '1.00.0',
      ];

      invalidVersions.forEach(version => {
        expect(() => configService.validateVersion(version)).toThrow(ValidationError);
      });
    });
  });

  describe('validateStackConfig', () => {
    const validConfig: StackConfig = {
      name: 'test-stack',
      version: '1.0.0',
      dependencies: [],
    };

    it('should accept valid minimal config', () => {
      const result = configService.validateStackConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should accept config with all optional fields', () => {
      const fullConfig = {
        name: 'test-stack',
        version: '1.0.0',
        description: 'A test stack',
        author: 'Test Author',
        dependencies: ['dep1', 'dep2'],
        scripts: {
          build: 'npm run build',
          test: 'npm test',
        },
        settings: {
          customSetting: 'value',
          nested: { key: 'value' },
        },
      };

      const result = configService.validateStackConfig(fullConfig);
      expect(result).toEqual(fullConfig);
    });

    it('should throw ValidationError for non-object config', () => {
      const invalidConfigs = [null, undefined, 'string', 123, true, []];

      invalidConfigs.forEach(config => {
        expect(() => configService.validateStackConfig(config)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError for missing required fields', () => {
      expect(() => configService.validateStackConfig({})).toThrow(ValidationError);

      expect(() => configService.validateStackConfig({ name: 'test' })).toThrow(ValidationError);

      expect(() => configService.validateStackConfig({ version: '1.0.0' })).toThrow(
        ValidationError
      );
    });

    it('should validate optional description field', () => {
      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          description: 123,
        })
      ).toThrow(ValidationError);
    });

    it('should validate optional author field', () => {
      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          author: 123,
        })
      ).toThrow(ValidationError);
    });

    it('should validate optional dependencies field', () => {
      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          dependencies: 'invalid',
        })
      ).toThrow(ValidationError);

      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          dependencies: [123, 'valid'],
        })
      ).toThrow(ValidationError);
    });

    it('should validate optional scripts field', () => {
      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          scripts: 'invalid',
        })
      ).toThrow(ValidationError);

      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          scripts: [],
        })
      ).toThrow(ValidationError);

      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          scripts: { build: 123 },
        })
      ).toThrow(ValidationError);
    });

    it('should validate optional settings field', () => {
      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          settings: 'invalid',
        })
      ).toThrow(ValidationError);

      expect(() =>
        configService.validateStackConfig({
          ...validConfig,
          settings: [],
        })
      ).toThrow(ValidationError);
    });
  });

  describe('loadConfig', () => {
    const configPath = '/test/config.json';
    const validConfigData = {
      name: 'test-stack',
      version: '1.0.0',
      dependencies: [],
    };

    it('should load and validate valid config file', async () => {
      mockFileService.readJsonFile.mockResolvedValue(validConfigData);

      const result = await configService.loadConfig(configPath);

      expect(mockFileService.readJsonFile).toHaveBeenCalledWith(configPath);
      expect(result).toEqual(validConfigData);
    });

    it('should throw ConfigurationError for invalid config data', async () => {
      const invalidConfigData = { name: 'test' }; // missing version
      mockFileService.readJsonFile.mockResolvedValue(invalidConfigData);

      await expect(configService.loadConfig(configPath)).rejects.toThrow(ConfigurationError);

      expect(mockFileService.readJsonFile).toHaveBeenCalledWith(configPath);
    });

    it('should propagate non-validation file service errors', async () => {
      const fileError = new Error('File not found');
      mockFileService.readJsonFile.mockRejectedValue(fileError);

      await expect(configService.loadConfig(configPath)).rejects.toThrow('File not found');
    });

    it('should wrap ValidationErrors in ConfigurationError', async () => {
      mockFileService.readJsonFile.mockResolvedValue({ invalid: 'config' });

      await expect(configService.loadConfig(configPath)).rejects.toThrow(ConfigurationError);

      try {
        await configService.loadConfig(configPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain('Invalid configuration');
      }
    });
  });

  describe('saveConfig', () => {
    const configPath = '/test/config.json';
    const validConfig: StackConfig = {
      name: 'test-stack',
      version: '1.0.0',
      dependencies: [],
    };

    it('should validate and save valid config', async () => {
      mockFileService.writeJsonFile.mockResolvedValue();

      await configService.saveConfig(configPath, validConfig);

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(configPath, validConfig);
    });

    it('should throw ConfigurationError for invalid config', async () => {
      const invalidConfig = { name: 'test' } as any; // missing version

      await expect(configService.saveConfig(configPath, invalidConfig)).rejects.toThrow(
        ConfigurationError
      );

      expect(mockFileService.writeJsonFile).not.toHaveBeenCalled();
    });

    it('should propagate file service errors', async () => {
      const fileError = new Error('Write failed');
      mockFileService.writeJsonFile.mockRejectedValue(fileError);

      await expect(configService.saveConfig(configPath, validConfig)).rejects.toThrow(
        'Write failed'
      );
    });

    it('should wrap ValidationErrors in ConfigurationError', async () => {
      const invalidConfig = { invalid: 'config' } as any;

      await expect(configService.saveConfig(configPath, invalidConfig)).rejects.toThrow(
        ConfigurationError
      );

      try {
        await configService.saveConfig(configPath, invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain(
          'Cannot save invalid configuration'
        );
      }
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default config with name and version', () => {
      const result = configService.createDefaultConfig('my-stack');

      expect(result).toEqual({
        name: 'my-stack',
        version: '1.0.0',
        dependencies: [],
        description: 'Development stack for my-stack',
      });
    });

    it('should create default config with custom version', () => {
      const result = configService.createDefaultConfig('my-stack', '2.1.0');

      expect(result).toEqual({
        name: 'my-stack',
        version: '2.1.0',
        dependencies: [],
        description: 'Development stack for my-stack',
      });
    });

    it('should validate stack name', () => {
      expect(() => configService.createDefaultConfig('invalid<name>')).toThrow(ValidationError);
    });

    it('should validate version', () => {
      expect(() => configService.createDefaultConfig('valid-name', 'invalid-version')).toThrow(
        ValidationError
      );
    });
  });

  describe('isValidStackConfig', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        name: 'test-stack',
        version: '1.0.0',
        dependencies: [],
      };

      expect(configService.isValidStackConfig(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { name: 'test' }, // missing version
        { version: '1.0.0' }, // missing name
        { name: 'test', version: 'invalid' },
        { name: 'invalid<name>', version: '1.0.0' },
      ];

      invalidConfigs.forEach(config => {
        expect(configService.isValidStackConfig(config)).toBe(false);
      });
    });

    it('should return true for config with all optional fields', () => {
      const fullConfig = {
        name: 'test-stack',
        version: '1.0.0',
        description: 'A test stack',
        author: 'Test Author',
        dependencies: ['dep1'],
        scripts: { build: 'npm run build' },
        settings: { key: 'value' },
      };

      expect(configService.isValidStackConfig(fullConfig)).toBe(true);
    });
  });

  describe('private validation methods', () => {
    describe('validateOptionalDescription', () => {
      it('should handle valid description', () => {
        const config = { description: 'Valid description' };
        const validatedConfig: StackConfig = { name: 'test', version: '1.0.0', dependencies: [] };

        // Access private method through any cast for testing
        (configService as any).validateOptionalDescription(config, validatedConfig);

        expect(validatedConfig.description).toBe('Valid description');
      });
    });

    describe('validateOptionalAuthor', () => {
      it('should handle valid author', () => {
        const config = { author: 'Test Author' };
        const validatedConfig: StackConfig = { name: 'test', version: '1.0.0', dependencies: [] };

        (configService as any).validateOptionalAuthor(config, validatedConfig);

        expect(validatedConfig.author).toBe('Test Author');
      });
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle extremely large valid configs', () => {
      const largeConfig = {
        name: 'test-stack',
        version: '1.0.0',
        dependencies: Array.from({ length: 1000 }, (_, i) => `dep-${i}`),
        scripts: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`script-${i}`, `command-${i}`])
        ),
        settings: {
          deeply: {
            nested: {
              settings: {
                with: {
                  many: {
                    levels: 'value',
                  },
                },
              },
            },
          },
        },
      };

      expect(() => configService.validateStackConfig(largeConfig)).not.toThrow();
    });

    it('should handle unicode characters in names', () => {
      const unicodeNames = ['测试', 'тест', 'τεστ', 'テスト'];

      unicodeNames.forEach(name => {
        expect(() => configService.validateStackName(name)).not.toThrow();
      });
    });

    it('should handle pre-release and build metadata versions', () => {
      const complexVersions = [
        '1.0.0-alpha.1',
        '2.0.0-rc.1+build.20230101',
        '1.2.3-beta.4.5.6+build.789',
      ];

      complexVersions.forEach(version => {
        expect(() => configService.validateVersion(version)).not.toThrow();
      });
    });
  });
});
