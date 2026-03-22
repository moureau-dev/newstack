import type { NewstackNode } from "./context";

declare global {
  namespace JSX {
    type Element = any;

    interface ElementChildrenAttribute {
      children: any;
    }

    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export type { NewstackNode };
