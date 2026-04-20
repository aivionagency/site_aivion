const http = require("http");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const storageDir = path.join(__dirname, "storage");
const leadsLogPath = path.join(storageDir, "contacts.jsonl");
const requestLog = new Map();

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

const mimeTypes = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=UTF-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=UTF-8" });
  response.end(JSON.stringify(payload));
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "script-src 'self' https://cdnjs.cloudflare.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; "));

  if (isProduction) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

function serveFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { ok: false, message: "Файл не найден." });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    applySecurityHeaders(response);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function sanitizeText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function ensureStorage() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 6;
  const recent = (requestLog.get(ip) || []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > maxRequests;
}

function buildLeadRecord(payload, request) {
  return {
    createdAt: new Date().toISOString(),
    ip: getClientIp(request),
    userAgent: sanitizeText(request.headers["user-agent"], 400),
    source: "website",
    firstName: sanitizeText(payload.firstName, 120),
    company: sanitizeText(payload.company, 180),
    contact: sanitizeText(payload.contact, 180),
    contactMethod: sanitizeText(payload.contactMethod, 60),
    role:
      payload.role === "Другое"
        ? sanitizeText(payload.customRole, 120) || "Другое"
        : sanitizeText(payload.role, 120),
    details: sanitizeText(payload.details, 4000),
    policyAccepted: Boolean(payload.policyAccepted),
    consentAccepted: Boolean(payload.consentAccepted)
  };
}

function validatePayload(payload) {
  if (String(payload.website || "").trim()) {
    return "Некорректная отправка формы.";
  }

  const requiredFields = ["firstName", "contact", "details"];

  for (const field of requiredFields) {
    if (!payload[field] || !String(payload[field]).trim()) {
      return `Поле "${field}" обязательно.`;
    }
  }

  if (payload.role === "Другое" && !String(payload.customRole || "").trim()) {
    return "Укажите роль в компании.";
  }

  if (!payload.policyAccepted || !payload.consentAccepted) {
    return "Нужно подтвердить согласие на обработку персональных данных и ознакомление с политикой.";
  }

  return null;
}

async function handleContact(request, response) {
  const chunks = [];

  request.on("data", (chunk) => {
    chunks.push(chunk);
  });

  request.on("end", async () => {
    try {
      const clientIp = getClientIp(request);

      if (isRateLimited(clientIp)) {
        sendJson(response, 429, {
          ok: false,
          message: "Слишком много запросов. Попробуйте ещё раз позже."
        });
        return;
      }

      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const validationError = validatePayload(body);

      if (validationError) {
        sendJson(response, 400, { ok: false, message: validationError });
        return;
      }

      ensureStorage();
      const leadRecord = buildLeadRecord(body, request);
      fs.appendFileSync(leadsLogPath, `${JSON.stringify(leadRecord)}\n`, "utf8");

      sendJson(response, 200, { ok: true, message: "Запрос принят." });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, {
        ok: false,
        message: "Не удалось сохранить запрос. Попробуйте снова."
      });
    }
  });
}

const server = http.createServer((request, response) => {
  applySecurityHeaders(response);
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && (requestUrl.pathname === "/contact" || requestUrl.pathname === "/contact/")) {
    serveFile(path.join(publicDir, "index.html"), response);
    return;
  }

  if (request.method === "GET" && (requestUrl.pathname === "/privacy" || requestUrl.pathname === "/privacy/")) {
    serveFile(path.join(publicDir, "privacy.html"), response);
    return;
  }

  if (request.method === "GET" && (requestUrl.pathname === "/consent" || requestUrl.pathname === "/consent/")) {
    serveFile(path.join(publicDir, "consent.html"), response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/contact") {
    handleContact(request, response);
    return;
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { ok: false, message: "Доступ запрещён." });
    return;
  }

  serveFile(filePath, response);
});

server.listen(port, () => {
  console.log(`Aivion запущен: http://127.0.0.1:${port}`);
});
