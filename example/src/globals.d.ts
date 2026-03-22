declare namespace JSX {
  type Element = any;

  interface ElementChildrenAttribute {
    children: {};
  }

  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
