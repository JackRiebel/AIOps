const { createServer } = require("https");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = false;
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Look for certificates in multiple locations
function findCerts() {
  const locations = [
    {
      key: path.join(__dirname, "certificates", "localhost-key.pem"),
      cert: path.join(__dirname, "certificates", "localhost.pem"),
    },
    {
      key: path.join(__dirname, "..", "certs", "key.pem"),
      cert: path.join(__dirname, "..", "certs", "cert.pem"),
    },
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc.key) && fs.existsSync(loc.cert)) {
      return {
        key: fs.readFileSync(loc.key),
        cert: fs.readFileSync(loc.cert),
      };
    }
  }

  console.error(
    "No SSL certificates found. Generate them with: mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1"
  );
  process.exit(1);
}

const httpsOptions = findCerts();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Lumen frontend ready on https://localhost:${port}`);
  });
});
