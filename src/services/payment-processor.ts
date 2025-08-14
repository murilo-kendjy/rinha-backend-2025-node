import { CONCURRENCY, QUEUE_SIZE } from "../constants.js";
import {
    getNext,
    getPaymentType,
    getSummary,
    markAsProcessed,
    redis,
    setService,
} from "../external/keydb.js";
import { makeRequest } from "../external/undici.js";
import {
    PaymentHealthCheck,
    PaymentJob,
    PaymentSummaryResponse,
} from "../types.js";
import { semaphore } from "../util.js";

const setDefault = () => {
    setService(0);
};

const setFallback = () => {
    setService(1);
};

const addBalance = async (payment: PaymentJob, type: number) => {
    markAsProcessed(type === 0 ? "default" : "fallback", payment);
};

const change = async () => {
    const lockKey = "switch-lock";
    const lockTTL = 200;

    const acquired = await redis.set(
        lockKey,
        "locked",
        "NX" as any,
        "EX" as any,
        lockTTL as any
    );

    if (acquired) {
        getPaymentType().then((res) => {
            if (res === 0) {
                setFallback();
            } else {
                setDefault();
            }

            redis.pexpire(lockKey, lockTTL);
        });
    }
};

const sendPayment = async (payment: PaymentJob, type: 0 | 1) => {
    payment.data.requestedAt = new Date().toISOString();
    const res = await makeRequest(
        type,
        "/payments",
        JSON.stringify(payment.data)
    );

    if (res.statusCode >= 400) {
        if (res.statusCode >= 500) {
            change();
        }

        await sendPayment(payment, type === 0 ? 1 : 0);
        return;
    }

    addBalance(payment, type);
};

const process = async (): Promise<any> => {
    const sem = semaphore(CONCURRENCY);
    while (true) {
        const items = await getNext(QUEUE_SIZE);
        if (!items || !items.length) {
            await new Promise((r) => setTimeout(r, 15));
            continue;
        }
        const type = await getPaymentType();
        for (const item of items) {
            const release = await sem.acquire();
            sendPayment(item, type).finally(() => release());
        }
    }
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

    console.log(serverDefault, serverFallBack);

    if (!serverDefault || serverDefault.failing) {
        setFallback();
        return;
    }

    if (!serverFallBack || serverFallBack.failing) {
        setDefault();
        return;
    }

    if (
        serverDefault.minResponseTime < 100 &&
        serverDefault.minResponseTime <= serverFallBack.minResponseTime * 1.4
    ) {
        setDefault();
    } else {
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

process();
startWorker();
