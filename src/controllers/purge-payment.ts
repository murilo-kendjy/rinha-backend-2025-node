import { IncomingMessage, ServerResponse } from "http";
import { flushall } from "../external/keydb.js";

export const purgePayment = async (
    req: IncomingMessage,
    res: ServerResponse
) => {
    try {
        await flushall();

        res.writeHead(200);
        res.end();
    } catch {
        res.writeHead(500);
        res.end();
    }
};
