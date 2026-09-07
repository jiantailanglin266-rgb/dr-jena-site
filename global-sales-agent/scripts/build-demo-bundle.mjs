import { build } from "esbuild";
await build({ entryPoints: ["src/demo-web/engine.ts"], bundle: true, format: "iife", globalName: "GSA", outfile: "public/demo/engine.js", minify: true, target: ["es2020"], platform: "browser", define: { "process.env.NODE_ENV": '"production"' } });
console.log("bundled → public/demo/engine.js");
