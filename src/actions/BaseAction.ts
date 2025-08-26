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
 * Interface for injecting services into actions
 */
export interface ActionServices {
  ui?: UIService;
  auth?: AuthService;
  api?: ApiService;
  metadata?: MetadataService;
  dependencies?: DependencyService;
  fileService?: FileService;
  configService?: ConfigService;
  stackService?: StackService;
  stackOperations?: StackOperationService;
}

/**
 * Base class for all CLI actions
 *
 * @remarks
 * Provides common services and functionality to all actions,
 * eliminating direct utility imports and reducing coupling.
 * All actions should extend this base class to access services.
 *
 * @since 1.2.3
 * @public
 */
export abstract class BaseAction {
  protected readonly ui: UIService;
  protected readonly auth: AuthService;
  protected readonly api: ApiService;
  protected readonly metadata: MetadataService;
  protected readonly dependencies: DependencyService;
  protected readonly fileService: FileService;
  protected readonly configService: ConfigService;
  protected readonly stackService: StackService;
  protected readonly stackOperations: StackOperationService;

  constructor(services?: ActionServices) {
    // Initialize services - use provided ones or create defaults
    this.ui = services?.ui ?? new UIService();
    this.auth = services?.auth ?? new AuthService();
    this.api = services?.api ?? new ApiService();
    this.metadata = services?.metadata ?? new MetadataService();
    this.dependencies = services?.dependencies ?? new DependencyService();
    this.fileService = services?.fileService ?? new FileService();
    this.configService = services?.configService ?? new ConfigService();
    this.stackService =
      services?.stackService ?? new StackService(this.fileService, this.configService);

    // Stack operations service depends on other services
    this.stackOperations =
      services?.stackOperations ??
      new StackOperationService(this.ui, this.dependencies, this.fileService);
  }

  /**
   * Handle errors in a consistent way across all actions
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
   */
  abstract execute(...args: unknown[]): Promise<void>;

  /**
   * Get the action name for logging and debugging
   */
  protected getActionName(): string {
    return this.constructor.name.replace('Action', '').toLowerCase();
  }

  /**
   * Log the start of an action
   */
  protected logActionStart(description?: string): void {
    const actionName = this.getActionName();
    const message = description || `Starting ${actionName} action`;
    this.ui.info(message);
  }

  /**
   * Validate that required parameters are provided
   */
  protected validateRequired(value: unknown, paramName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Required parameter '${paramName}' is missing or empty`);
    }
  }

  /**
   * Check if the API is in local development mode and display appropriate message
   */
  protected displayApiEnvironment(): void {
    if (this.api.isLocalDev()) {
      this.ui.meta(`   Using local backend: ${this.api.getBaseUrl()}`);
    }
  }
}
