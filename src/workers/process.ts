import { parentPort } from "worker_threads";
import { CONCURRENCY, QUEUE_SIZE } from "../constants.js";
import {
    getNext,
    getPaymentType,
    getTime,
    redis,
    setService,
} from "../external/keydb.js";
import { makeRequest } from "../external/undici.js";
import { PaymentJob, queue } from "../types.js";
import { calcFactor, semaphore } from "../util.js";

const setDefault = () => {
    setService(0);
};

const setFallback = () => {
    setService(1);
};

const markAsProcessed = async (queue: queue, payment: PaymentJob) => {
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

const addBalance = async (payment: PaymentJob, type: number) => {
    await markAsProcessed(type === 0 ? "default" : "fallback", payment);
};

const change = async () => {
    const lockKey = "switch-lock";
    const lockTTL = 250;

    const acquired = await redis.set(lockKey, "locked", "PX", lockTTL, "NX");

    if (acquired) {
        getPaymentType().then((res) => {
            if (res === 0) {
                setFallback();
            } else {
                setDefault();
            }
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

    await addBalance(payment, type);
};

const process = async (): Promise<any> => {
    const sem = semaphore(CONCURRENCY);
    let timeout = 0;
    while (true) {
        const type = await getPaymentType();
        const time = await getTime();

        if (timeout <= 10 && type === 1) {
            timeout++;
            await new Promise((r) => setTimeout(r, 500));
            continue;
        } else {
            timeout = 0;
        }

        const factor = calcFactor(type, time);

        const items = await getNext(
            QUEUE_SIZE * factor > 500 ? 500 : QUEUE_SIZE * factor
        );
        if (!items || !items.length) {
            await new Promise((r) => setTimeout(r, 15));
            continue;
        }

        sem.setMax(CONCURRENCY * factor);
        for (const item of items) {
            const release = await sem.acquire();
            sendPayment(item, type).finally(() => release());
        }
    }
};

(async () => {
    try {
        await process();
    } catch (err) {
        if (err instanceof Error) {
            parentPort?.postMessage({ error: err?.message });
        } else {
            parentPort?.postMessage({ error: "Some err" });
        }
    }
})();
