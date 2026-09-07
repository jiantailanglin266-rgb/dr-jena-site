import { readFileSync, writeFileSync } from "node:fs";
const t = readFileSync("public/demo/index.template.html", "utf8");
const js = readFileSync("public/demo/engine.js", "utf8").replace(/<\/script>/g, "<\\/script>");
const body = t.replace("<script>/*ENGINE*/</script>", "<script>" + js + "</script>");
writeFileSync("public/demo/index.html", '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + body + "</html>");
console.log("assembled → public/demo/index.html");
