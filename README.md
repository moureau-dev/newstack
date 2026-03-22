# Newstack

A framework **extremely** similar to [Nullstack](https://nullstack.app/), but using different techs:

- [Hono](https://hono.dev/) for the server
- [ESBuild](https://esbuild.github.io/) for the bundler
- [Biome](https://biomejs.dev/) for the default linter and formatter

# Roadmap
- [x] Server-side rendering
- [ ] Client-side rendering
  - [x] Hydration
  - [x] Navigation
  - [x] Destruction 
  - [x] Reactivity with proxies
  - [x] Bundle splitting with dynamic imports
  - [x] Two-way data binding 
- [x] Components with JSX (no react)
- [x] Public folder for assets
- [ ] Server functions
  - [x] Basic execution
  - [ ] Context aware executions
- [ ] Option to build for Node and Bun
- [ ] Biome integration
- [ ] Tests
- [ ] CLI to create new projects
- [ ] Context
  - [x] (Server) Environment
  - [x] (Client) Current route
  - [x] (Client) Environment
  - [x] (Server) Secrets
  - [x] (Client) Page
  - [x] (Client) Params
  - [x] (Client) Router
  - [x] (Client) Settings
