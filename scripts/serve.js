// Tiny static file server for the web/ folder -> http://localhost:8080
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "web");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  if (p === "/ethers.min.js") p = null;
  const file = p ? path.join(root, p) : path.join(__dirname, "..", "node_modules", "ethers", "dist", "ethers.umd.min.js");
  if (p && !file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/javascript" });
    res.end(data);
  });
}).listen(8080, () => console.log("UI at http://localhost:8080"));
