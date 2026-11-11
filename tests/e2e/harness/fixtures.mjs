// Stands in for an external project, on fixed ports:
//   4000  its file storage: serves sample.pdf with CORS
//   4100  one of its websites (an allowed origin): host pages that frame the viewer
//   4200  a website NOT on the project's list
//   4300  its webhook receiver: records deliveries; GET /control?mode=ok|fail&reset=1 changes it
// Writes received webhooks to <out>/received.json. Usage: node fixtures.mjs <out dir>
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { samplePdf } from "./sample-pdf.mjs";

const out = process.argv[2];
const pdf = samplePdf();
writeFileSync(join(out, "sample.pdf"), pdf);
const reactBundle = () => readFileSync(join(out, "react.js"));
const esc = (v) => v.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);

http
  .createServer((req, res) => {
    if (req.url.startsWith("/sample.pdf")) {
      res.writeHead(200, { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*" });
      return res.end(pdf);
    }
    res.writeHead(404);
    res.end();
  })
  .listen(4000);

for (const port of [4100, 4200]) {
  http
    .createServer((req, res) => {
      const u = new URL(req.url, "http://x");
      const src = u.searchParams.get("src") ?? "";
      const page = (html) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!doctype html><title>host ${port}</title>${html}`);
      };
      if (u.pathname === "/react.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(reactBundle());
      }
      if (u.pathname === "/react") return page(`<div id="root"></div><script src="/react.js"></script>`);
      if (u.pathname === "/sdk-auto")
        return page(`<h1>Auto</h1><div id="box" data-flipbook-url="${esc(src)}" data-flipbook-height="600" data-flipbook-title="Auto doc"></div>
    <script>window.domEvents=[];document.addEventListener("flipbook:pagechange",e=>domEvents.push(e.detail));document.addEventListener("flipbook:ready",e=>domEvents.push(e.detail));</script>
    <script src="http://localhost:3000/sdk/v1/flipbook.js" async></script>`);
      if (u.pathname === "/sdk-mount")
        return page(`<h1>Mount</h1><div id="newsletter"></div>
    <script src="http://localhost:3000/sdk/v1/flipbook.js"></script>
    <script>window.log=[];window.viewer=Flipbook.mount("#newsletter",{url:${JSON.stringify(src)},height:"80vh",onReady:e=>log.push(e)});
    viewer.on("pagechange",e=>log.push(e)).on("linkclick",e=>log.push(e));
    try{Flipbook.mount("#newsletter",{url:"https://evil.example/x"});window.badUrl="accepted"}catch(e){window.badUrl=e.message}</script>`);
      page(`<h1>Host page ${port}</h1><iframe id="v" src="${esc(src)}" allow="fullscreen" style="width:100%;height:720px;border:0"></iframe>`);
    })
    .listen(port);
}

let mode = "ok";
const received = [];
const dump = join(out, "received.json");
writeFileSync(dump, "[]");
http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/control") {
      mode = u.searchParams.get("mode") ?? mode;
      if (u.searchParams.has("reset")) {
        received.length = 0;
        writeFileSync(dump, "[]");
      }
      return res.end(mode);
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const status = mode === "fail" ? 500 : 200;
      received.push({ at: Date.now(), status, signature: req.headers["flipbook-signature"], body });
      writeFileSync(dump, JSON.stringify(received));
      res.writeHead(status);
      res.end(status === 200 ? "ok" : "nope");
    });
  })
  .listen(4300);

console.log("fixtures ready");
