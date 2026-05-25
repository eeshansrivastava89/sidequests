# Agent Instructions

## How I Work With You

- I use this project as a side project tracker. I care about the product working correctly, not about technical sophistication for its own sake.
- I prefer direct conversation. Tell me what's wrong, not what might be wrong. If you're unsure, say so and propose a quick test to find out.
- I value speed of iteration over perfection. Ship something that works, then refine.
- When I say something is broken, it's broken. Don't talk me into believing it's fine. Investigate until you find the actual cause.
- I will ask you to do research before implementing. That's intentional. Spend time understanding the problem space before writing code.

## Debugging Principles

### Test the simplest hypothesis first

When debugging streaming, real-time, or ordering issues, **build the smallest possible reproduction before changing anything.** If SSE events arrive in batches, write a 10-line test server that sends events with artificial delays. If that works, the transport is fine — the problem is in your code, not the framework.

### Suspect your own code before the framework

Frameworks like Express, React, and Vite are battle-tested by millions of users. If something isn't working, the bug is almost certainly in how you're using it, not in the framework itself. Before migrating frameworks or rewriting abstractions, verify the simplest possible usage works.

### Isolate before you refactor

This project spent hours migrating from Hono to Express to fix an SSE buffering bug that turned out to be event loop starvation from `execFileSync()`. The migration was a 3-4 hour detour that didn't fix the actual problem. The fix was one line: `await setImmediate()` after each `res.write()`. **Always isolate the actual failure before making structural changes.**

### Write a test, then fix the bug

If you can't reproduce a bug in isolation, you don't understand it well enough to fix it. Write a minimal test that demonstrates the failure, confirm it fails, then fix it, then confirm the test passes.

### Check the event loop

Node.js is single-threaded. `execFileSync`, `readFileSync`, `cp.execSync`, and CPU-heavy synchronous loops block the event loop. While the loop is blocked, no network I/O, no setTimeout callbacks, no stream drains, no TCP flushes can happen. If data "arrives all at once," check whether synchronous work is starving the event loop between writes.

## Architecture Principles

### Prefer established, boring tools

Use the thing everyone else uses. Express over Hono. React over Svelte for this project. SQLite over Postgres for a local-first tool. The more popular a tool is, the more likely someone has already hit and fixed every edge case. Novel frameworks invite novel bugs.

### Minimize code, minimize dependencies

Every line of code is a liability. Every dependency is a risk surface. If you can remove code without losing functionality, remove it. If a dependency does something you can do in 20 lines yourself (and those 20 lines won't grow), consider writing it yourself. If a dependency does something complex that you'd get wrong, use the dependency.

### Maximize DRY, minimize indirection

If the same pattern appears three times, extract it. But extract it to the simplest abstraction that covers all three cases — don't create a pluggable factory builder when a shared function does the job. Indirection should serve readability, not abstract flexibility you don't yet need.

### The simplest architecture that could possibly work

Before adding a layer (abstraction, service, middleware, wrapper), ask: does this layer remove complexity, or just move it? If moving it doesn't make the code shorter or easier to understand, don't add the layer. The best architecture is the one where you can trace a feature from click to database in the fewest jumps.

### Don't fight the framework

If you're working around the framework's abstractions (accessing raw Node.js response objects inside Hono's streamSSE, padding SSE chunks to 16KB, adding flush helpers), the framework is the wrong tool. Switch to a tool that gives you direct access to what you need. But switch *after* confirming the framework is the problem, not before.

### Local-first means simple

This is a single-user desktop tool distributed via npm. It doesn't need microservices, message queues, or distributed caches. SQLite is the right database. A local Express server is the right backend. The simplest architecture is: Node.js process + SQLite file + static SPA. Don't overscale it.

## Code Style

- Prefer `async/await` over callbacks. Prefer named functions over inline lambdas when the lambda exceeds 5 lines.
- Use early returns to reduce nesting. A function should read top-to-bottom, not inside-out.
- Types should describe what the data is, not what operations are available on it. Prefer discriminated unions over class hierarchies.
- Comments should explain *why*, not *what*. The code explains what.
- Delete dead code immediately. Don't comment it out "just in case." That's what git history is for.