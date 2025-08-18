import { Health } from "./types";

export const semaphore = (max: number) => {
    let current = 0;
    let queue: Array<(release: () => void) => void> = [];

    const next = () => {
        if (queue.length > 0 && current < max) {
            current++;
            const resolve = queue.shift()!;
            resolve(() => {
                current--;
                next();
            });
        }
    };

    const acquire = async (): Promise<() => void> => {
        if (current < max) {
            current++;
            return () => {
                current--;
                next();
            };
        }

        return new Promise((resolve) => {
            queue.push(resolve);
        });
    };

    return { acquire, setMax: (m: number) => (max = m) };
};

export const calcFactor = (
    health: Health,
    forceFallback = false
): { factor: number; type: 0 | 1 | null } => {
    if (!health.d && !health.f) {
        return { factor: 0, type: null };
    }

    if (forceFallback) {
        return { factor: 1, type: 1 };
    }

    if (health.d && health.dMs === 0) {
        return { factor: 20, type: 0 };
    } else if (health.d && health.dMs <= 50) {
        return { factor: 5, type: 0 };
    } else if (health.d) {
        return { factor: 2, type: 0 };
    } else if (health.f) {
        return { factor: 0.5, type: 1 };
    } else {
        return { factor: 0, type: null };
    }
};

export const pack = (
    d: boolean,
    f: boolean,
    dMs: number,
    fMs: number
): Buffer => {
    let value = 0;

    if (d) {
        value |= 1;
    }
    if (f) {
        value |= 1 << 1;
    }

    value |= (dMs & 0x3fff) << 2;

    value |= (fMs & 0x3fff) << 16;

    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32BE(value, 0);
    return buf;
};

export const unpack = (buf: Buffer): Health => {
    const value = buf.readUInt32BE(0);

    const d = (value & 1) !== 0;
    const f = (value & 2) !== 0;

    const dMs = (value >> 2) & 0x3fff;
    const fMs = (value >> 16) & 0x3fff;

    return { d, f, dMs, fMs };
};
