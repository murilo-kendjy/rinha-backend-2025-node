import Redis from "ioredis";
import { KEYDB_HOST, KEYDB_PORT } from "../constants.js";
import { PaymentJob, queue } from "../types.js";

export const redis = new Redis({
    host: KEYDB_HOST,
    port: KEYDB_PORT,
});
const redisStream = redis.duplicate();

export const createGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            "payments_stream",
            "payments_group",
            "$",
            "MKSTREAM"
        );
    } catch {}
};

export const getPaymentType = async (): Promise<0 | 1> => {
    return parseInt((await redis.get("type")) || "0") as 0 | 1;
};

export const getTime = async (): Promise<number> => {
    return parseInt((await redis.get("time")) || "0") as number;
};

export const setService = async (type: 0 | 1) => {
    await redis.set("type", type);
};

export const getNext = async (count = 1) => {
    const entries = await redisStream.xreadgroup(
        "GROUP",
        "payments_group",
        "consumer-" + process.pid,
        "COUNT",
        count,
        "BLOCK",
        0,
        "STREAMS",
        "payments_stream",
        ">"
    );

    if (!entries) {
        return null;
    }

    const items = entries.flatMap(([, messages]: any) =>
        messages.map(([id, fields]: any) => ({
            id,
            data: JSON.parse(fields[1]),
        }))
    );

    return items as PaymentJob[];
};

export const getSummary = async (
    queue: queue,
    startTs: number,
    endTs: number
) => {
    const ids = await redis.zrangebyscore(
        `payment:index:${queue}`,
        startTs,
        endTs
    );

    if (ids.length === 0) {
        return { totalRequests: 0, totalAmount: 0 };
    }

    const amounts = await redis.hmget("payments:amounts", ...ids);
    const totalAmount = amounts.reduce(
        (sum, val) => sum + parseFloat(val || "0"),
        0
    );

    return {
        totalRequests: ids.length,
        totalAmount,
    };
};
