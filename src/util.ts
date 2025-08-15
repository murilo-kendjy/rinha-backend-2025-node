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
