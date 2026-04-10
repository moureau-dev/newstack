import type { Newstack } from "../core";

export type IconSize = 72 | 96 | 128 | 144 | 152 | 192 | 384 | 512;

export type NewstackNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | NewstackNode[];

export interface NewstackPage {
  title: string;
  image: string;
  description?: string;
  locale: string;
}

export interface NewstackProject {
  domain: string;
  name: string;
  icons: Record<IconSize, string>;
  favicon: string;
  cdn: string;
}

export interface NewstackRouter {
  url: string;
  path: string;
  base: string;
  event: string;
  previous: string;
}

export interface NewstackEnvironment {
  client: boolean;
  server: boolean;
  development: boolean;
  production: boolean;
}

export interface NewstackParams extends Record<string, string | boolean> {}
export interface NewstackSettings
  extends Record<string, string | number | boolean> {}
export interface NewstackSecrets
  extends Record<string, string | number | boolean> {}
export interface NewstackDependencies extends Record<string, any> {}

// biome-ignore lint/suspicious/noEmptyInterface:
export interface NewstackWorker {}

/**
 * Collection of instances of Newstack classes that can be used to store
 * and manage state or services across the application.
 */
export interface NewstackInstances extends Record<string, Newstack> {}

interface NewstackCommonContext {
  /**
   * Page metadata
   */
  page: NewstackPage;

  /**
   * Unique hash for the current build, used for cache-busting assets.
   */
  fingerprint: string;

  /**
   * Information about the app manifest and metadata
   */
  project: NewstackProject;

  /**
   * Map of public settings and configuration that can
   * be used in the application.
   */
  settings: NewstackSettings;

  /**
   * Environment information
   */
  environment: "client" | "server";
  // environment: NewstackEnvironment;

  path: string;

  /**
   * Registry of named component instances.
   * Components declare themselves with key="name" and become accessible
   * to the entire tree via context.instances.name
   */
  instances: NewstackInstances;
}

export type NewstackClientContext<T = unknown> = NewstackCommonContext & {
  /**
   * Newstack router information
   */
  router: NewstackRouter;

  /**
   * Query parameters from the URL
   */
  params: NewstackParams;

  worker?: NewstackWorker;

  /**
   * The DOM event that triggered the current handler call, if any.
   */
  event?: Event;
  // instances?: NewstackInstances;
  /**
   * Bind object
   */
  bind?: { property: string | number; object: any }[];

  /**
   * Bind value
   */
  value?: any;

  /**
   * Ref object
   */
  ref?: T extends { ref: any }
    ? T["ref"]
    : {
        object: any;
        property: string | number;
      };

  /**
   * Ref reference
   */
  element?: Element;
} & T;

export type NewstackServerContext<T = unknown> = NewstackCommonContext & {
  /**
   * Map of secrets that are not exposed to the client.
   */
  secrets: NewstackSecrets;

  /**
   * Map of dependencies that can be used in the application.
   */
  deps: NewstackDependencies;
} & T;

export abstract class NewstackComponent<T> {
  prepared: boolean;
  hydrated: boolean;
  abstract hydrate(context?: NewstackClientContext<T>): void;
  abstract prepare(context?: NewstackClientContext<T>): void;
  abstract update(context?: NewstackClientContext<T>): void;
  abstract destroy(context?: NewstackClientContext<T>): void;
  abstract render(context?: NewstackClientContext<T>): any;
}
