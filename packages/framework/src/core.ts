import {
  type NewstackClientContext,
  type NewstackServerContext,
  NewstackComponent,
} from "./types/context";

type VoidOrPromise = void | Promise<void>;

export {
  NewstackClientContext,
  NewstackServerContext,
  NewstackNode,
} from "./types/context";

/**
 * @description
 * Newstack Component base class that provides all the necessary methods and properties
 * for creating a Newstack component.
 */
// @ts-ignore
export abstract class Newstack<T = {}> extends NewstackComponent<T> {
  /**
   * @description
   * Component identifier automatically set in the build time.
   */
  static hash: string;

  constructor() {
    super();

    // biome-ignore lint/correctness/noConstructorReturn: <explanation>
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === "constructor") return target.constructor;

        // If the property is not found, return undefined
        return Reflect.get(target, prop);
      },
      set: (target, prop, value) => {
        if (prop === "__node" || prop === "__hash") {
          target[prop] = value;
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });
  }

  /** Automatically set to true after prepare() completes. */
  prepared = false;
  /** Automatically set to true after hydrate() completes. */
  hydrated = false;

  /** Method automatically ran in the server when this is being served for the first time and automatically ran in the client before the HTML is rendered in the DOM */
  prepare?(
    context?: NewstackClientContext<T> | NewstackServerContext<T>,
  ): VoidOrPromise;
  /** Method automatically ran in the client right after the HTML is rendered in the DOM. */
  hydrate?(context?: NewstackClientContext<T>): VoidOrPromise;
  /** Method automatically ran in the client when the component or children reactivity are updated. */
  update?(context?: NewstackClientContext<T>): VoidOrPromise;
  /** Method automatically ran in the client when the component is no longer in the DOM. */
  destroy?(context?: NewstackClientContext<T>): VoidOrPromise;
  /** Method automatically ran in the client for reactivity and ran once in the server for first-page-view SSR. */
  render?(context?: NewstackClientContext<T>): any;
}
