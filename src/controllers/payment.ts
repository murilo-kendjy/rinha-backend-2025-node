import { IncomingMessage, ServerResponse } from "http";
import { add } from "../external/keydb.js";
import { startWorker } from "../services/payment-processor.js";

startWorker();

export const payment = (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
        try {
            add(chunks);
            res.writeHead(201);
            res.end();
        } catch {
            res.writeHead(500);
            res.end();
        }
    });
};
