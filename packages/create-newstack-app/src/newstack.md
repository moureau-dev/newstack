# Newstack — AI Reference Guide

Newstack is a full-stack SSR/SSG/SPA framework with proxy-based reactivity, no virtual DOM, and an esbuild bundler. Components run on both server and client.

---

## Component Anatomy

```tsx
import Newstack, { type NewstackClientContext } from "newstack";

export class Counter extends Newstack {
  // State: plain class properties. Setting them triggers re-render automatically.
  count = 0;

  // Runs on server (SSR) AND on client before first render.
  // Use for data fetching, initializing state from context.
  prepare(context: NewstackClientContext) {
    context.page.title = "Counter";
  }

  // Runs on client only, after DOM is painted. Use for subscriptions, timers, etc.
  hydrate(context: NewstackClientContext) {
    console.log("mounted");
  }

  // Runs on client whenever any property on this component changes.
  update(context: NewstackClientContext) {}

  // Runs on client when component is removed from DOM.
  destroy(context: NewstackClientContext) {}

  // Required. Runs on server (SSR) and client. Returns JSX.
  render(context: NewstackClientContext) {
    return <div>{this.count}</div>;
  }
}
```

- All lifecycle methods are **optional** except `render`.
- `this` inside render is **always the proxy** — mutating `this.count++` triggers a re-render.
- Components must be **classes** (not functions).
- `this.prepared` and `this.hydrated` are set to `true` automatically after each lifecycle completes. Use in `render()` to show loading states.

---

## Reactivity

Just set properties. No setState, no signals, no stores.

```tsx
this.count++;                    // re-renders
this.user = { name };            // re-renders
this.items = [...this.items, x]; // re-renders
this.items.push(x);              // re-renders — mutations in lifecycle methods and event handlers are batched
```

`prepare` and `hydrate` (including async) are fully batched — all mutations are collected and a single re-render fires when they complete.

---

## Event Handlers

Two valid forms:

```tsx
// Arrow function — works as expected
<button onclick={() => this.count++}>+</button>

// Method reference — auto-binds this and passes (context, event)
<button onclick={this.handleClick}>click</button>
```

When using method reference form, the method signature is:

```tsx
handleClick(context: NewstackClientContext, e: Event) {
  this.count++;
}
```

`e.preventDefault()` is called automatically on all events.

---

## Two-Way Binding

Use `bind={this.prop}` on any input, textarea, or select:

```tsx
<input bind={this.name} />
<input type="checkbox" bind={this.checked} />
<select bind={this.selected}>...</select>
```

Nested properties work too:

```tsx
// ✅ works — object is initialized
form = { name: "", age: 0 };
<input bind={this.form.name} />

// ✅ works — empty object is fine
form: Partial<{ name: string }> = {};
<input bind={this.form.name} />

// ❌ fails — form is undefined, this.form.name throws at runtime
form;
<input bind={this.form.name} />
```

- For text inputs: syncs `el.value` ↔ `this.prop`.
- For checkboxes: syncs `el.checked` ↔ `this.prop`.
- Works with `oninput` / `onchange` under the hood — don't add those manually.
- Nested objects must be **at minimum initialized to `{}`** — binding to a property of `undefined` will throw.

---

## Context

Two context shapes exist. On the server, `environment === "server"`. On the client, `environment === "client"`.

```ts
// Always available
context.environment       // "server" | "client"
context.params            // route params e.g. { id: "42" }
context.deps              // injected dependencies (db, logger, etc.)
context.instances         // named component instances registered via key=""
context.instances.auth    // safe — returns {} if not yet registered

// Client only
context.router.path       // current path string
context.router.navigate(path: string) // client-side navigation
context.page.title        // sets <title>

// Server only
context.path              // request path
```

---

## Routing

Define routes inline with the `route` prop:

```tsx
render(context) {
  return (
    <main>
      <Home route="/" />
      <About route="/about" />
      <Profile route="/profile/:id" />
      <NotFound route="*" />
    </main>
  );
}
```

- Components with a non-matching `route` render as `<!---->` (invisible).
- Dynamic params are available via `context.params.id`.
- `route="*"` is a catch-all.
- Client navigation is handled automatically — links with `href` are patched.

---

## Server Functions

Static async methods on a component execute on the server. The client calls them via a generated POST route.

```tsx
export class UserList extends Newstack {
  users = [];

  // Runs on server. Has access to context.deps.
  static async getUsers(context: NewstackServerContext) {
    return context.deps.db.query("SELECT * FROM users");
  }

  async hydrate(context: NewstackClientContext) {
    // Calling a static method from the client POSTs to /api/newstack/:hash/getUsers
    this.users = await UserList.getUsers(context);
  }

  render() {
    return <ul>{this.users.map(u => <li>{u.name}</li>)}</ul>;
  }
}
```

- Static methods receive `context` as their first argument.
- Return value is JSON-serialized and sent to client.
- Never expose secrets in return values — the response goes to the browser.

---

## Component Instances (`key` + `context.instances`)

Register a component by name so other components can access it via `context.instances`:

```tsx
// Register
<Sidebar key="sidebar" />

// Access from any component
render(context) {
  const sidebar = context.instances.sidebar;
  return <button onclick={() => sidebar.open = true}>Open</button>;
}
```

- `key` is a string identifier — the component is available as `context.instances[key]`.
- Accessing an unregistered instance returns `{}` (safe — no crash).
- Components without `render()` work fine as instances (e.g. service/store components).

**Typed instances** — augment `NewstackInstances` to get full type inference:

```ts
// globals.d.ts
import type { Sidebar } from "./src/Sidebar";

declare module "newstack" {
  interface NewstackInstances {
    sidebar: Sidebar;
  }
}
```

After this, `context.instances.sidebar` is fully typed — no `as any` needed.

---

## Persistent Components (`persistent`)

By default, components are destroyed and re-initialized on route changes. Add `persistent` to preserve state:

```tsx
// Component state survives navigation
<AuthStore key="auth" persistent />

// From anywhere
render(context) {
  return <p>User: {context.instances.auth.user?.name}</p>;
}
```

- Combine with `key` to use as a global store accessible from `context.instances`.
- `destroy()` and `terminate()` are NOT called on route change for persistent components.
- `prepare()` and `hydrate()` still run on first mount only.

---

## Dependency Injection

Pass deps when starting the server. Available everywhere via `context.deps`.

```ts
server.start(app, {
  deps: { db, logger, config },
});
```

```tsx
prepare(context) {
  const data = await context.deps.db.find(context.params.id);
  this.data = data;
}
```

---

## Entry Point (server)

```ts
import { NewstackServer } from "newstack/server";
import { App } from "./App";

const server = new NewstackServer();
server.start(new App(), { deps: { db } });
```

---

## Entry Point (client)

```ts
import { NewstackClient } from "newstack";
import { App } from "./App";

const client = new NewstackClient();
client.start(new App());
```

---

## Stateless Function Components

Plain functions returning JSX work as `<MyComponent />` — no class, no lifecycle, no reactivity.

```tsx
function Badge({ label }: { label: string }) {
  return <span class="badge">{label}</span>;
}

// Used as:
render() {
  return <div><Badge label="new" /></div>;
}
```

---

## Loading States with `hydrated` / `prepared`

```tsx
export class UserList extends Newstack {
  users = [];

  async hydrate() {
    this.users = await UserList.getUsers();
  }

  render() {
    if (!this.hydrated) return <p>Loading...</p>;
    return <ul>{this.users.map(u => <li>{u.name}</li>)}</ul>;
  }
}
```

---

## JSX

- Factory is `h` from `@newstack/jsx`. Injected automatically by the bundler — no manual import needed.
- Standard JSX syntax. Use `class` not `className`. Use `onclick` not `onClick` (lowercase DOM events).

```tsx
// ✅
<div class="box" onclick={() => this.open = true}>

// ❌
<div className="box" onClick={() => this.open = true}>
```

---

## Build & Dev

```bash
newstack start        # dev server with HMR (watch mode)
newstack build        # production SSR build
newstack build --mode=ssg  # static site generation
newstack build --mode=spa  # SPA (client-only) build
```

esbuild config lives in `esbuild.config.ts` at project root:

```ts
import { builder } from "newstack/builder";

export default {
  server: { ...builder.server },
  client: { ...builder.client },
};
```

---

## SSR + Hydration Flow

1. Request → server renders component tree to HTML string.
2. Component state serialized into `window.__NEWSTACK_STATE__` in `<head>`.
3. Browser loads `client.js` → restores state → hydrates DOM (no re-render, just event attachment).
4. Subsequent state changes trigger `patchElement()` — direct DOM diffing, no vdom.

---

## Common Mistakes

| Wrong | Right |
|---|---|
| `this.list.push(x)` in `update()` outside of an event | `update` is not batched — push won't trigger a re-render there. Use `this.list = [...this.list, x]` instead. |
| `onClick={...}` | `onclick={...}` |
| `className="foo"` | `class="foo"` |
| `import { h } from "@newstack/jsx"` | Not needed — injected automatically |
| Accessing `window` in `prepare()` | Only safe in `hydrate()` / `update()` |
| Returning multiple root elements | Wrap in a single parent element |

### update()

- `update()` behaves like a reactive effect.
- It automatically tracks any properties accessed during execution.
- It re-runs when any of those properties change.
- Mutating tracked properties inside `update()` can cause infinite loops.
