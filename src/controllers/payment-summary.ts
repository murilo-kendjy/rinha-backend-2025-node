import { IncomingMessage, ServerResponse } from "http";
import { getBalance } from "../external/keydb.js";

export const paymentSummary = async (
    req: IncomingMessage,
    res: ServerResponse,
    rawQuery: string
) => {
    try {
        const query: Record<string, string> = {};
        if (rawQuery) {
            for (const pair of rawQuery.split("&")) {
                const [key, value] = pair.split("=");
                query[key] = value;
            }
        }

        const d = await getBalance(
            new Date(query.from || new Date("2025-01-01")).getTime(),
            new Date(query.to || new Date("2026-01-01")).getTime()
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(d));
    } catch {
        res.writeHead(500);
        res.end();
    }
};
