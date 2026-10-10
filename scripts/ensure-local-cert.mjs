import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const key = "certificates/localhost-key.pem";
const cert = "certificates/localhost.pem";

function validCertificate() {
  if (!existsSync(key) || !existsSync(cert)) return false;
  const result = spawnSync("openssl", ["x509", "-in", cert, "-noout", "-checkend", "86400"], { stdio: "ignore" });
  return result.status === 0;
}

if (!validCertificate()) {
  mkdirSync("certificates", { recursive: true });
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "825",
    "-keyout", key, "-out", cert, "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1",
  ], { stdio: "ignore" });
  console.log("Generated a local HTTPS certificate in certificates/.");
}

chmodSync(key, 0o600);
