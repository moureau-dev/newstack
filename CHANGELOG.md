# Changelog

## 0.0.64

### CDN / `mount()` improvements

- **Auto-hashing**: Components without a `static hash` are now automatically assigned a hash at setup time. No need to manually declare `static hash = "..."` when using Newstack via CDN or `mount()`.
- **Route params in `prepare()`**: `context.params` is now correctly populated before `prepare()` runs when using `mount()`. Previously, params were only available during rendering, making them inaccessible in the `prepare` lifecycle.
- **Child lifecycle on `mount()`**: `prepare()` and `hydrate()` are now called on all visible child components when using `mount()`, not just the root component.
- **Route params on navigation**: `context.params` is now re-extracted before `prepare()` is called on route changes when using `mount()`.
- **`context.router.path` on initial load**: Fixed `context.router.path` being `undefined` on the initial render when using `mount()` without a server.
