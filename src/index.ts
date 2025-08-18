// @ts-nocheck
import { createServer } from "http";
import { Worker } from "node:worker_threads";
import { PORT } from "./constants.js";
import { paymentSummary } from "./controllers/payment-summary.js";
import { payment } from "./controllers/payment.js";
import { purgePayment } from "./controllers/purge-payment.js";

new Worker(new URL("./workers/process.js", import.meta.url));

async function main() {
    const server = createServer((req, res) => {
        const [pathname, rawQuery] = req.url?.split("?");

        if (pathname === "/payments" && req.method === "POST") {
            payment(req, res);
        } else if (pathname === "/payments-summary" && req.method === "GET") {
            paymentSummary(req, res, rawQuery);
        } else if (pathname === "/purge-payments" && req.method === "POST") {
            purgePayment(req, res);
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
