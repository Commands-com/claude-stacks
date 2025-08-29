import {
  ApiService,
  AuthService,
  ConfigService,
  DependencyService,
  FileService,
  MetadataService,
  StackService,
  UIService,
} from '../services/index.js';
import { StackOperationService } from '../services/StackOperationService.js';

/**
 * Interface for injecting services into actions through dependency injection
 *
 * @remarks
 * Defines optional service dependencies that can be injected into BaseAction
 * and its subclasses. This interface supports the dependency injection pattern
 * used throughout the CLI action architecture, allowing for better testability
 * and modularity. Services are optional to support both testing scenarios
 * (with mocked services) and production scenarios (with default instances).
 *
 * @example
 * ```typescript
 * // Using with mocked services for testing
 * const mockServices: ActionServices = {
 *   ui: mockUIService,
 *   auth: mockAuthService,
 *   api: mockApiService
 * };
 * const action = new InstallAction(mockServices);
 *
 * // Using with default services in production
 * const action = new InstallAction();
 * ```
 *
 * @since 1.2.3
 * @public
 */
export interface ActionServices {
  /**
   * User interface service for console output and user interaction
   *
   * @remarks
   * Handles all console output including colored text, progress indicators,
   * user prompts, and error messages. Essential for all user-facing operations.
   *
   * @default new UIService()
   */
  ui?: UIService;

  /**
   * Authentication service for managing user credentials and tokens
   *
   * @remarks
   * Handles user authentication, token storage, and authentication state.
   * Required for operations that interact with the Commands.com API.
   *
   * @default new AuthService()
   */
  auth?: AuthService;

  /**
   * API service for HTTP requests to Commands.com backend
   *
   * @remarks
   * Manages all HTTP communication with the Commands.com API, including
   * environment detection (local vs production) and request configuration.
   *
   * @default new ApiService()
   */
  api?: ApiService;

  /**
   * Metadata service for handling stack metadata operations
   *
   * @remarks
   * Handles reading, writing, and validation of stack metadata files,
   * including claude_desktop_config.json and stack configuration.
   *
   * @default new MetadataService()
   */
  metadata?: MetadataService;

  /**
   * Dependency service for managing package dependencies
   *
   * @remarks
   * Handles installation, validation, and management of package dependencies
   * for stacks, including npm, pip, and other package managers.
   *
   * @default new DependencyService()
   */
  dependencies?: DependencyService;

  /**
   * File service for file system operations
   *
   * @remarks
   * Provides file and directory operations including reading, writing,
   * copying, and managing the Claude configuration directory structure.
   *
   * @default new FileService()
   */
  fileService?: FileService;

  /**
   * Configuration service for managing Claude desktop configuration
   *
   * @remarks
   * Handles reading and writing the claude_desktop_config.json file,
   * managing MCP server configurations, and configuration validation.
   *
   * @default new ConfigService()
   */
  configService?: ConfigService;

  /**
   * Stack service for stack lifecycle management
   *
   * @remarks
   * High-level service for managing stack operations including installation,
   * uninstallation, validation, and local stack management. Depends on
   * fileService and configService for operation.
   *
   * @default new StackService(fileService, configService)
   */
  stackService?: StackService;

  /**
   * Stack operations service for complex stack manipulations
   *
   * @remarks
   * Handles complex stack operations like merging configurations, managing
   * dependencies, and orchestrating multi-step stack operations. Depends on
   * ui, dependencies, and fileService for operation.
   *
   * @default new StackOperationService(ui, dependencies, fileService)
   */
  stackOperations?: StackOperationService;
}

/**
 * Base class for all CLI actions using dependency injection pattern
 *
 * @remarks
 * Provides common services and functionality to all CLI actions through
 * dependency injection, eliminating direct utility imports and reducing
 * coupling between actions and services. All action classes should extend
 * this base class to access the standardized service layer. Services are
 * initialized during construction with support for both default instances
 * (production) and injected instances (testing).
 *
 * The class implements a two-phase initialization pattern:
 * 1. Core services (UI, Auth, API, Metadata) are initialized first
 * 2. Dependent services (those requiring other services) are initialized second
 *
 * @example
 * ```typescript
 * // Extending BaseAction in a concrete action
 * export class InstallAction extends BaseAction {
 *   async execute(stackId: string): Promise<void> {
 *     // Access inherited services directly
 *     this.ui.info('Installing stack...');
 *     const token = await this.auth.authenticate();
 *     const stack = await this.api.getStack(stackId, token);
 *     await this.stackService.installStack(stack);
 *   }
 * }
 *
 * // Using with dependency injection for testing
 * const action = new InstallAction({
 *   ui: mockUIService,
 *   auth: mockAuthService,
 *   api: mockApiService
 * });
 * ```
 *
 * @since 1.2.3
 * @public
 */
export abstract class BaseAction {
  /**
   * User interface service for console output and user interaction
   *
   * @remarks
   * Inherited from ActionServices interface. Handles all console output
   * including colored text, progress indicators, user prompts, and error
   * messages. All user-facing operations should use this service.
   *
   * @protected
   */
  protected ui!: UIService;

  /**
   * Authentication service for managing user credentials and tokens
   *
   * @remarks
   * Inherited from ActionServices interface. Handles user authentication,
   * token storage, and authentication state. Required for operations that
   * interact with the Commands.com API.
   *
   * @protected
   */
  protected auth!: AuthService;

  /**
   * API service for HTTP requests to Commands.com backend
   *
   * @remarks
   * Inherited from ActionServices interface. Manages all HTTP communication
   * with the Commands.com API, including environment detection (local vs
   * production) and request configuration.
   *
   * @protected
   */
  protected api!: ApiService;

  /**
   * Metadata service for handling stack metadata operations
   *
   * @remarks
   * Inherited from ActionServices interface. Handles reading, writing, and
   * validation of stack metadata files, including claude_desktop_config.json
   * and stack configuration.
   *
   * @protected
   */
  protected metadata!: MetadataService;

  /**
   * Dependency service for managing package dependencies
   *
   * @remarks
   * Inherited from ActionServices interface. Handles installation, validation,
   * and management of package dependencies for stacks, including npm, pip,
   * and other package managers.
   *
   * @protected
   */
  protected dependencies!: DependencyService;

  /**
   * File service for file system operations
   *
   * @remarks
   * Inherited from ActionServices interface. Provides file and directory
   * operations including reading, writing, copying, and managing the Claude
   * configuration directory structure.
   *
   * @protected
   */
  protected fileService!: FileService;

  /**
   * Configuration service for managing Claude desktop configuration
   *
   * @remarks
   * Inherited from ActionServices interface. Handles reading and writing
   * the claude_desktop_config.json file, managing MCP server configurations,
   * and configuration validation.
   *
   * @protected
   */
  protected configService!: ConfigService;

  /**
   * Stack service for stack lifecycle management
   *
   * @remarks
   * Inherited from ActionServices interface. High-level service for managing
   * stack operations including installation, uninstallation, validation, and
   * local stack management. Depends on fileService and configService.
   *
   * @protected
   */
  protected stackService!: StackService;

  /**
   * Stack operations service for complex stack manipulations
   *
   * @remarks
   * Inherited from ActionServices interface. Handles complex stack operations
   * like merging configurations, managing dependencies, and orchestrating
   * multi-step stack operations. Depends on ui, dependencies, and fileService.
   *
   * @protected
   */
  protected stackOperations!: StackOperationService;

  /**
   * Initialize a new BaseAction with optional service dependencies
   *
   * @remarks
   * Constructs a new BaseAction instance using the dependency injection pattern.
   * Services can be provided for testing scenarios, or default instances will
   * be created for production use. The constructor follows a two-phase
   * initialization pattern to handle service dependencies correctly.
   *
   * Initialization phases:
   * 1. Core services (UI, Auth, API, Metadata) - no dependencies
   * 2. Basic services (Dependencies, FileService, ConfigService) - no cross-dependencies
   * 3. Complex services (StackService, StackOperations) - depend on other services
   *
   * @param services - Optional service dependencies to inject
   * @throws Error if service initialization fails
   *
   * @example
   * ```typescript
   * // Production usage with default services
   * class MyAction extends BaseAction {
   *   constructor() {
   *     super(); // Uses default service instances
   *   }
   * }
   *
   * // Testing usage with mocked services
   * const mockServices: ActionServices = {
   *   ui: mockUIService,
   *   fileService: mockFileService
   * };
   * const action = new MyAction(mockServices);
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  constructor(services?: ActionServices) {
    this.initializeCoreServices(services);
    this.stackService = this.initializeStackService(services);
    this.stackOperations = this.initializeStackOperations(services);
  }

  /**
   * Initialize core services in proper dependency order
   *
   * @remarks
   * Orchestrates the two-phase initialization of core services, ensuring
   * that services with no dependencies are initialized first, followed by
   * services that may depend on previously initialized services.
   *
   * @param services - Optional service dependencies to inject
   * @throws Error if any service initialization fails
   *
   * @private
   * @since 1.2.3
   */
  private initializeCoreServices(services?: ActionServices): void {
    this.initializeBasicServices(services);
    this.initializeDependentServices(services);
  }

  /**
   * Initialize basic services with no cross-dependencies
   *
   * @remarks
   * Initializes the foundational services that have no dependencies on other
   * services. These services can be safely initialized in any order as they
   * are self-contained.
   *
   * Services initialized: UI, Auth, API, Metadata
   *
   * @param services - Optional service dependencies to inject
   * @throws Error if any service constructor fails
   *
   * @private
   * @since 1.2.3
   */
  private initializeBasicServices(services?: ActionServices): void {
    this.ui = services?.ui ?? new UIService();
    this.auth = services?.auth ?? new AuthService();
    this.api = services?.api ?? new ApiService();
    this.metadata = services?.metadata ?? new MetadataService();
  }

  /**
   * Initialize services that may have dependencies but no cross-dependencies
   *
   * @remarks
   * Initializes services that are independent of each other but may depend
   * on external systems or configuration. These services can be safely
   * initialized after basic services are available.
   *
   * Services initialized: Dependencies, FileService, ConfigService
   *
   * @param services - Optional service dependencies to inject
   * @throws Error if any service constructor fails
   *
   * @private
   * @since 1.2.3
   */
  private initializeDependentServices(services?: ActionServices): void {
    this.dependencies = services?.dependencies ?? new DependencyService();
    this.fileService = services?.fileService ?? new FileService();
    this.configService = services?.configService ?? new ConfigService();
  }

  /**
   * Initialize the StackService with its required dependencies
   *
   * @remarks
   * Creates a StackService instance that depends on FileService and
   * ConfigService. This service handles high-level stack operations and
   * requires both file system access and configuration management.
   *
   * @param services - Optional service dependencies to inject
   * @returns Initialized StackService instance
   * @throws Error if StackService constructor fails or dependencies are invalid
   *
   * @private
   * @since 1.2.3
   */
  private initializeStackService(services?: ActionServices): StackService {
    return services?.stackService ?? new StackService(this.fileService, this.configService);
  }

  /**
   * Initialize the StackOperationService with its required dependencies
   *
   * @remarks
   * Creates a StackOperationService instance that depends on UIService,
   * DependencyService, and FileService. This service handles complex stack
   * operations that require user interaction, dependency management, and
   * file system operations.
   *
   * @param services - Optional service dependencies to inject
   * @returns Initialized StackOperationService instance
   * @throws Error if StackOperationService constructor fails or dependencies are invalid
   *
   * @private
   * @since 1.2.3
   */
  private initializeStackOperations(services?: ActionServices): StackOperationService {
    return (
      services?.stackOperations ??
      new StackOperationService(this.ui, this.dependencies, this.fileService)
    );
  }

  /**
   * Handle errors in a consistent way across all actions
   *
   * @remarks
   * Provides standardized error handling for all CLI actions. In test
   * environments, throws the error to allow test frameworks to catch it.
   * In production environments, logs the error using the UI service and
   * exits the process with error code 1.
   *
   * @param error - The error to handle (any type)
   * @param prefix - Optional prefix for error message display
   * @throws Error in test environment (NODE_ENV === 'test')
   * @returns Never returns in production (calls process.exit)
   *
   * @example
   * ```typescript
   * try {
   *   await this.stackService.installStack(stack);
   * } catch (error) {
   *   this.handleError(error, 'Stack installation');
   * }
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  protected handleError(error: unknown, prefix = 'Operation'): never {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // In test environment, throw error instead of exiting
    if (process.env.NODE_ENV === 'test') {
      throw new Error(errorMessage);
    }

    this.ui.error(`${prefix} failed:`, errorMessage);
    process.exit(1);
  }

  /**
   * Execute the action - must be implemented by subclasses
   *
   * @remarks
   * Abstract method that defines the main execution logic for each action.
   * Subclasses must implement this method to provide their specific functionality.
   * The method signature is flexible to accommodate different parameter patterns
   * used by various CLI commands.
   *
   * @param args - Variable arguments specific to each action implementation
   * @returns Promise that resolves when the action completes
   * @throws Error if the action fails or encounters validation errors
   *
   * @example
   * ```typescript
   * // Example implementation in InstallAction
   * async execute(stackId: string, options?: InstallOptions): Promise<void> {
   *   this.validateRequired(stackId, 'stackId');
   *   this.logActionStart(`Installing stack ${stackId}`);
   *
   *   try {
   *     const token = await this.auth.authenticate();
   *     const stack = await this.api.getStack(stackId, token);
   *     await this.stackService.installStack(stack);
   *   } catch (error) {
   *     this.handleError(error, 'Stack installation');
   *   }
   * }
   * ```
   *
   * @since 1.2.3
   * @public
   */
  abstract execute(...args: unknown[]): Promise<void>; // eslint-disable-line no-unused-vars

  /**
   * Get the action name for logging and debugging
   *
   * @remarks
   * Derives the action name from the class constructor name by removing the
   * 'Action' suffix and converting to lowercase. Used for consistent logging
   * and debugging output across all actions.
   *
   * @returns The lowercase action name without 'Action' suffix
   *
   * @example
   * ```typescript
   * // For class 'InstallAction', returns 'install'
   * // For class 'PublishAction', returns 'publish'
   * const actionName = this.getActionName();
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  protected getActionName(): string {
    return this.constructor.name.replace('Action', '').toLowerCase();
  }

  /**
   * Log the start of an action with optional custom description
   *
   * @remarks
   * Provides consistent action start logging across all CLI actions. Uses the
   * derived action name if no custom description is provided. Helps with
   * debugging and provides user feedback about action progress.
   *
   * @param description - Optional custom description for the action start
   *
   * @example
   * ```typescript
   * // Using default description
   * this.logActionStart(); // "Starting install action"
   *
   * // Using custom description
   * this.logActionStart('Installing stack from registry');
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  protected logActionStart(description?: string): void {
    const actionName = this.getActionName();
    const message = description ?? `Starting ${actionName} action`;
    this.ui.info(message);
  }

  /**
   * Validate that required parameters are provided and non-empty
   *
   * @remarks
   * Performs validation for required parameters, checking for undefined, null,
   * or empty string values. Throws a descriptive error if validation fails,
   * which can be caught and handled by the action's error handling logic.
   *
   * @param value - The value to validate
   * @param paramName - The parameter name for error messages
   * @throws Error if the value is undefined, null, or empty string
   *
   * @example
   * ```typescript
   * async execute(stackId: string, version?: string): Promise<void> {
   *   this.validateRequired(stackId, 'stackId');
   *   // version is optional, so not validated
   *
   *   // Continue with action logic...
   * }
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  protected validateRequired(value: unknown, paramName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Required parameter '${paramName}' is missing or empty`);
    }
  }

  /**
   * Display API environment information when in local development mode
   *
   * @remarks
   * Checks if the API service is configured for local development and displays
   * the local backend URL to the user. Useful for debugging and development
   * scenarios where developers need to know which backend is being used.
   *
   * @example
   * ```typescript
   * async execute(stackId: string): Promise<void> {
   *   this.displayApiEnvironment(); // Shows "Using local backend: http://localhost:3000"
   *
   *   // Continue with action logic...
   * }
   * ```
   *
   * @since 1.2.3
   * @protected
   */
  protected displayApiEnvironment(): void {
    if (this.api.isLocalDev()) {
      this.ui.meta(`   Using local backend: ${this.api.getBaseUrl()}`);
    }
  }
}
