let current = 0;
let queue: Array<(release: () => void) => void> = [];

export const semaphore = (max: number) => {
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

export const calcFactor = (type: 0 | 1, time: number) => {
    if (type === 0 && time === 0) {
        return 8;
    } else if (type === 0 && time <= 50) {
        return 5;
    } else if (type === 0) {
        return 2;
    } else {
        return 0.5;
    }
};
