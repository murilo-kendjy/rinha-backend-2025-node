import { Worker } from "node:worker_threads";
import { getSummary, redis, setService } from "../external/keydb.js";
import { makeRequest } from "../external/undici.js";
import { PaymentHealthCheck, PaymentSummaryResponse } from "../types.js";

new Worker(new URL("../workers/process.js", import.meta.url));

const setDefault = () => {
    setService(0);
};

const setFallback = () => {
    setService(1);
};

const healthCheck = async (type: 0 | 1) => {
    try {
        const res = await makeRequest(type, "/payments/service-health");

        if (res.statusCode >= 400) {
            return undefined;
        }

        return (await res.responseBody.json()) as PaymentHealthCheck;
    } catch {}
};

const chooseType = async () => {
    const [serverDefault, serverFallBack] = await Promise.all([
        healthCheck(0),
        healthCheck(1),
    ]);

    if (!serverDefault || serverDefault.failing) {
        redis.set("time", serverFallBack?.minResponseTime || 0);
        setFallback();
        return;
    }

    if (!serverFallBack || serverFallBack.failing) {
        redis.set("time", serverDefault?.minResponseTime || 0);
        setDefault();
        return;
    }

    if (
        serverDefault.minResponseTime < 100 &&
        serverDefault.minResponseTime <= serverFallBack.minResponseTime * 1.4
    ) {
        redis.set("time", serverDefault?.minResponseTime || 0);
        setDefault();
    } else {
        redis.set("time", serverFallBack?.minResponseTime || 0);
        setFallback();
    }
};

const startWorker = async () => {
    const lockKey = "worker-lock";
    const lockTTL = 10000;

    while (true) {
        const acquired = await redis.set(
            lockKey,
            "locked",
            "NX" as any,
            "EX" as any,
            lockTTL as any
        );

        if (acquired) {
            chooseType();
            await redis.pexpire(lockKey, lockTTL);
        }
        await new Promise((r) => setTimeout(r, 5000));
    }
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

startWorker();
