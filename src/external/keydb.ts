import Redis from "ioredis";
import { KEYDB_HOST, KEYDB_PORT } from "../constants.js";
import { PaymentJob, PaymentSummaryResponse, queue } from "../types.js";
import { pack } from "../util.js";

const redis = new Redis({
    host: KEYDB_HOST,
    port: KEYDB_PORT,
});
const redisStream = redis.duplicate();

export const setLockKey = async (lockKey: string, lockTTL: number) => {
    return await redis.set(lockKey, "locked", "PX", lockTTL, "NX");
};

const createGroup = async () => {
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

createGroup();

export const setHealth = (d: boolean, f: boolean, dMs: number, fMs: number) => {
    redis.set("health", pack(d, f, dMs, fMs));
};

setHealth(true, true, 0, 0);

export const getHealth = async () => {
    return await redis.getBuffer("health");
};

export const flushall = async () => {
    await redis.flushall();
    await createGroup();
};

export const add = (chunks: Buffer[]) => {
    redis.xadd("payments_stream", "*", "payload", Buffer.concat(chunks));
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

const getSummary = async (queue: queue, startTs: number, endTs: number) => {
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

export const getBalance = async (
    startTs: number,
    endTs: number
): Promise<PaymentSummaryResponse> => {
    const [d, f] = await Promise.all([
        getSummary("default", startTs, endTs),
        getSummary("fallback", startTs, endTs),
    ]);
    return {
        default: d,
        fallback: f,
    };
};

export const markAsProcessed = async (queue: queue, payment: PaymentJob) => {
    const ts = new Date(payment.data.requestedAt).getTime();

    await redis
        .pipeline()
        .xack("payments_stream", "payments_group", payment.id)
        .hset(
            `payments:amounts`,
            payment.data.correlationId,
            payment.data.amount
        )
        .zadd(`payment:index:${queue}`, ts, payment.data.correlationId)
        .exec();
};
