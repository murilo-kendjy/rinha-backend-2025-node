import { parentPort } from "worker_threads";
import { CONCURRENCY, CONNECTIONS, QUEUE_SIZE } from "../constants.js";
import { getHealth, getNext, markAsProcessed } from "../external/keydb.js";
import { makeRequest } from "../external/undici.js";
import { PaymentJob } from "../types.js";
import { calcFactor, semaphore, unpack } from "../util.js";

interface CircuitBreaker {
    open: boolean;
    failCount: number;
    lastFail: number;
}

const dCircuit: CircuitBreaker = { open: false, failCount: 0, lastFail: 0 };
const fCircuit: CircuitBreaker = { open: false, failCount: 0, lastFail: 0 };
const retryQueue: PaymentJob[] = [];

const circuitFail = (c: CircuitBreaker) => {
    c.open = true;
    c.lastFail = Date.now();
    c.failCount++;
};

const resetCircuit = (c: CircuitBreaker) => {
    c.failCount = 0;
    c.lastFail = 0;
    c.open = false;
};

const addBalance = async (payment: PaymentJob, type: number) => {
    await markAsProcessed(type === 0 ? "default" : "fallback", payment);
};

const sendPayment = async (payment: PaymentJob, type: 0 | 1) => {
    try {
        payment.data.requestedAt = new Date().toISOString();
        const res = await makeRequest(
            type,
            "/payments",
            JSON.stringify(payment.data)
        );

        if (res.statusCode >= 500) {
            circuitFail(type === 0 ? dCircuit : fCircuit);

            throw new Error("PSP failure");
        }

        resetCircuit(type === 0 ? dCircuit : fCircuit);

        await addBalance(payment, type);
    } catch {
        retryQueue.push(payment);
    }
};

const choosePayment = () => {
    if (!dCircuit.open) {
        return 0;
    }

    if (Date.now() - (dCircuit.lastFail || Date.now()) > 800) {
        resetCircuit(dCircuit);
        return null;
    }

    if (dCircuit.open && fCircuit.open) {
        return null;
    }

    if (dCircuit.failCount > 20) {
        resetCircuit(dCircuit);
        return 1;
    }

    return null;
};

const reprocess = async (): Promise<any> => {
    const sem = semaphore(125);
    while (true) {
        if (!retryQueue.length) {
            await new Promise((r) => setTimeout(r, 20));
            continue;
        }

        const job = retryQueue.shift()!;
        const type = choosePayment();

        if (type === null) {
            retryQueue.push(job);
            await new Promise((r) => setTimeout(r, 50));
            continue;
        }

        const release = await sem.acquire();
        sendPayment(job, type).finally(() => release());
    }
};

const process = async (): Promise<any> => {
    const sem = semaphore(CONCURRENCY);
    let forceFetch = 0;
    while (true) {
        const buf = await getHealth();
        if (!buf) {
            await new Promise((r) => setTimeout(r, 50));
            continue;
        }

        const health = unpack(buf);
        if (!health.d) {
            await new Promise((r) => setTimeout(r, 50));
            continue;
        }

        if (health.d) {
            resetCircuit(dCircuit);
        }

        if (dCircuit.open && forceFetch < 50) {
            forceFetch++;
            await new Promise((r) => setTimeout(r, 50));
            continue;
        }

        forceFetch = 0;

        const factor = calcFactor(health);
        if (factor.type === null) {
            continue;
        }

        const batchSize = Math.min(QUEUE_SIZE * factor.factor, 500);
        const items = await getNext(batchSize);
        if (!items || !items.length) {
            await new Promise((r) => setTimeout(r, 15));
            continue;
        }

        sem.setMax(CONCURRENCY * factor.factor);
        for (const item of items) {
            const useFallback = factor.type === 0 && dCircuit.open;

            if (useFallback) {
                retryQueue.push(item);
                continue;
            }

            const release = await sem.acquire();
            sendPayment(item, 0).finally(() => release());
        }
    }
};

const warmup = async () => {
    const promises = [
        ...Array.from({ length: CONNECTIONS }, () =>
            makeRequest(0, "/payments/service-health").catch(() => {})
        ),
        ...Array.from({ length: CONNECTIONS }, () =>
            makeRequest(1, "/payments/service-health").catch(() => {})
        ),
    ];

    await Promise.all(promises);
};

(async () => {
    console.log("Worker Started");
    try {
        warmup();
        await Promise.all([process(), reprocess()]);
    } catch (err) {
        if (err instanceof Error) {
            parentPort?.postMessage({ error: err?.message });
        } else {
            parentPort?.postMessage({ error: "Some err" });
        }
    }
})();
