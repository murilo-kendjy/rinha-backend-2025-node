export const PORT = Number(process.env.PORT || "9999");
export const QUEUE_SIZE = Number(process.env.QUEUE_SIZE || "200");
export const CONCURRENCY = Number(process.env.CONCURRENCY || "25");
export const CONNECTIONS = Number(process.env.CONNECTIONS || "10");
export const PIPELINING = Number(process.env.PIPELINING || "10");
export const PAYMENT_URL_DEFAULT =
    process.env.PAYMENT_URL_DEFAULT || "http://localhost:8001";
export const PAYMENT_URL_FALLBACK =
    process.env.PAYMENT_URL_FALLBACK || "http://localhost:8002";
export const KEYDB_HOST = process.env.KEYDB_HOST || "localhost";
export const KEYDB_PORT = Number(process.env.KEYDB_PORT || "6379");
