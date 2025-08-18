import { setHealth, setLockKey } from "../external/keydb.js";
import { makeRequest } from "../external/undici.js";
import { PaymentHealthCheck } from "../types.js";

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

    setHealth(
        !serverDefault?.failing || false,
        !serverFallBack?.failing || false,
        serverDefault?.minResponseTime || 0,
        serverFallBack?.minResponseTime || 0
    );
};

export const startWorker = async () => {
    const lockKey = "worker-lock";
    const lockTTL = 2000;

    while (true) {
        const acquired = await setLockKey(lockKey, lockTTL);

        if (acquired) {
            chooseType();
        }
        await new Promise((r) => setTimeout(r, 5000));
    }
};
