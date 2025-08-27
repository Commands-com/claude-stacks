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
  protected ui!: UIService;
  protected auth!: AuthService;
  protected api!: ApiService;
  protected metadata!: MetadataService;
  protected dependencies!: DependencyService;
  protected fileService!: FileService;
  protected configService!: ConfigService;
  protected stackService!: StackService;
  protected stackOperations!: StackOperationService;

  constructor(services?: ActionServices) {
    this.initializeCoreServices(services);
    this.stackService = this.initializeStackService(services);
    this.stackOperations = this.initializeStackOperations(services);
  }

  private initializeCoreServices(services?: ActionServices): void {
    this.initializeBasicServices(services);
    this.initializeDependentServices(services);
  }

  private initializeBasicServices(services?: ActionServices): void {
    this.ui = services?.ui ?? new UIService();
    this.auth = services?.auth ?? new AuthService();
    this.api = services?.api ?? new ApiService();
    this.metadata = services?.metadata ?? new MetadataService();
  }

  private initializeDependentServices(services?: ActionServices): void {
    this.dependencies = services?.dependencies ?? new DependencyService();
    this.fileService = services?.fileService ?? new FileService();
    this.configService = services?.configService ?? new ConfigService();
  }

  private initializeStackService(services?: ActionServices): StackService {
    return services?.stackService ?? new StackService(this.fileService, this.configService);
  }

  private initializeStackOperations(services?: ActionServices): StackOperationService {
    return (
      services?.stackOperations ??
      new StackOperationService(this.ui, this.dependencies, this.fileService)
    );
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
  abstract execute(...args: unknown[]): Promise<void>; // eslint-disable-line no-unused-vars

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
    const message = description ?? `Starting ${actionName} action`;
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
