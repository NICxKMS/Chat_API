// Minimal runtime-agnostic logger.

export function createLogger(level = "info") {
  const levels = ["error", "warn", "info", "debug"];
  const should = (l) => levels.indexOf(l) <= levels.indexOf(level);
  const ts = () => new Date().toISOString();
  return {
    error: (msg, meta) => should("error") && console.error(ts(), "[ERROR]", msg, meta || ""),
    warn: (msg, meta) => should("warn") && console.warn(ts(), "[WARN]", msg, meta || ""),
    info: (msg, meta) => should("info") && console.log(ts(), "[INFO]", msg, meta || ""),
    debug: (msg, meta) => should("debug") && console.log(ts(), "[DEBUG]", msg, meta || ""),
  };
}


