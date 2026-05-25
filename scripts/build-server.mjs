import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/server.js",
  external: ["@prisma/adapter-libsql", "libsql", "better-sqlite3", "cpu-features", "encoding"],
  banner: {
    js: 'import{createRequire}from"module";const require=createRequire(import.meta.url);',
  },
});