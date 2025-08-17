// @ts-nocheck
import { createServer } from "http";
import { PORT } from "./constants.js";
import { createGroup, redis } from "./external/keydb.js";
import { getBalance } from "./services/payment-processor.js";

async function main() {
    await createGroup();

    const server = createServer((req, res) => {
        const [pathname, rawQuery] = req.url?.split("?");

        if (pathname === "/payments" && req.method === "POST") {
            let body = "";
            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => {
                try {
                    redis.xadd(
                        "payments_stream",
                        "*",
                        "payload",
                        Buffer.concat(chunks)
                    );

                    res.writeHead(201);
                    res.end();
                } catch {
                    res.writeHead(500);
                    res.end();
                }
            });
        } else if (pathname === "/payments-summary" && req.method === "GET") {
            const query = {};
            if (rawQuery) {
                for (const pair of rawQuery.split("&")) {
                    const [key, value] = pair.split("=");
                    query[key] = value;
                }
            }
            getBalance(
                new Date(query.from || new Date("2025-01-01")).getTime(),
                new Date(query.to || new Date("2026-01-01")).getTime()
            )
                .then((d) => {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(d));
                })
                .catch(() => {
                    res.writeHead(500);
                    res.end();
                });
        } else if (pathname === "/purge-payments" && req.method === "POST") {
            redis
                .flushall()
                .then(() => {
                    createGroup()
                        .then(() => {
                            res.writeHead(200);
                            res.end();
                        })
                        .catch(() => {
                            res.writeHead(500);
                            res.end();
                        });
                })
                .catch(() => {
                    res.writeHead(500);
                    res.end();
                });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    try {
        server.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}/`);
        });
    } catch (err) {
        process.exit(1);
    }
}

main();
