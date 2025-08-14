// @ts-nocheck
import { createServer } from "http";
import { PORT } from "./constants.js";

async function main() {
    const server = createServer((req, res) => {
        res.writeHead(200);
        res.end();
    });

    try {
        server.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}/`);
        });
    } catch (err) {
        process.exit(1);
    }
}

main();
