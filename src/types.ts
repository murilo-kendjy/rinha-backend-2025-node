export type queue = "default" | "fallback";

export interface Balance {
    totalRequests: number;
    totalAmount: number;
}

export interface PaymentCreate {
    correlationId: string;
    amount: number;
}

export interface PaymentQuery {
    from?: string;
    to?: string;
}

export interface PostPaymentBody extends PaymentCreate {
    requestedAt: string;
}

export interface PaymentHealthCheck {
    failing: boolean;
    minResponseTime: number;
}

export interface PaymentJob {
    id: string;
    data: PostPaymentBody;
}

export interface PaymentSummaryItem {
    totalRequests: number;
    totalAmount: number;
}

export interface PaymentSummaryResponse {
    default: PaymentSummaryItem;
    fallback: PaymentSummaryItem;
}
