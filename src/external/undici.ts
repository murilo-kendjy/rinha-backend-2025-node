import { Pool } from "undici";
import {
    CONNECTIONS,
    PAYMENT_URL_DEFAULT,
    PAYMENT_URL_FALLBACK,
    PIPELINING,
} from "../constants.js";

export const poolDefault = new Pool(PAYMENT_URL_DEFAULT, {
    connections: CONNECTIONS,
    pipelining: PIPELINING,
    keepAliveTimeout: 120000,
});

export const poolFallback = new Pool(PAYMENT_URL_FALLBACK, {
    connections: CONNECTIONS,
    pipelining: PIPELINING,
    keepAliveTimeout: 120000,
});

const h = {
    "Content-Type": "application/json",
};

export const makeRequest = async (type: 0 | 1, path: string, body?: string) => {
    const opts: any = {
        method: body ? "POST" : "GET",
        headers: h,
    };

    if (body) {
        opts.body = body;
    }

    const pool = type === 0 ? poolDefault : poolFallback;

    try {
        const { statusCode, body: responseBody } = await pool.request({
            path,
            ...opts,
        });

        return { statusCode, responseBody };
    } catch (err) {
        throw err;
    }
};
