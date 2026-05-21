const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

async function build() {
  fs.mkdirSync("dist", { recursive: true });

  await esbuild.build({
    entryPoints: ["code.js"],
    bundle: true,
    outfile: "dist/code.js",
    platform: "browser",
    target: "es2017",
    format: "iife",
  });

  const processShim = [
    "(function(){",
    "var g=typeof globalThis!=='undefined'?globalThis:typeof self!=='undefined'?self:this;",
    "if(typeof g.process==='undefined'){",
    "g.process={env:{NODE_ENV:'production'},browser:true,version:''};",
    "}",
    "})();",
  ].join("");

  const uiBundle = await esbuild.build({
    entryPoints: ["ui.js"],
    bundle: true,
    write: false,
    platform: "browser",
    target: "es2017",
    format: "iife",
    banner: { js: processShim },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  const uiJs = uiBundle.outputFiles[0].text;
  let template = fs.readFileSync("ui.html", "utf8");

  if (fs.existsSync("dashboard.html")) {
    const dashboard = fs.readFileSync("dashboard.html", "utf8");
    const escaped = dashboard
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    template = template.replace(
      /<textarea id="jsx">[\s\S]*?<\/textarea>/,
      `<textarea id="jsx">${escaped}</textarea>`
    );
  }

  const inlined = template.replace(
    /<script>[\s\S]*?<\/script>\s*<\/body>/,
    `<script>${uiJs}</script>\n</body>`
  );
  fs.writeFileSync(path.join("dist", "ui.html"), inlined);

  console.log("Build complete: dist/code.js, dist/ui.html");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
