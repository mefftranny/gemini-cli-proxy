
import { spawn, ChildProcess } from 'child_process';
import { fetch } from 'undici';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const API_KEY = "any-key"; // Proxy ignores this mostly or checks structure

interface RequestSample {
    duration: number;
    ttfb?: number;
    status: number;
    error?: string;
}

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(retries = 20): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`${BASE_URL}/health`);
            if (res.ok) return true;
        } catch (e) {
            // ignore
        }
        await wait(1000); // Increased wait time to 1s
    }
    return false;
}

async function makeRequest(model: string = "gpt-3.5-turbo"): Promise<RequestSample> {
    const start = performance.now();
    try {
        const response = await fetch(`${BASE_URL}/openai/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Say hello!" }],
                max_tokens: 10
            })
        });

        // Simple TTFB approximation (time until headers received) - usually response.blob() etc waits for body
        // fetch resolves when headers are received
        const ttfb = performance.now() - start;

        await response.text();
        const end = performance.now();

        return {
            duration: end - start,
            ttfb: ttfb,
            status: response.status
        };
    } catch (error) {
        return {
            duration: performance.now() - start,
            status: 0,
            error: String(error)
        };
    }
}

async function runBenchmark() {
    console.log("Starting server...");
    const serverProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts', '--port', PORT.toString()], {
        stdio: 'inherit',
        env: { ...process.env, DISABLE_BROWSER_AUTH: 'true' } // headless mode
    });

    try {
        const ready = await waitForServer();
        if (!ready) {
            console.error("Server failed to start");
            return;
        }
        console.log("Server is ready. Starting benchmark...");

        // Warmup / First Request (Metrics include project discovery)
        console.log("\n--- First Request (Cold Start / Project Discovery) ---");
        const firstReq = await makeRequest();
        console.log(`Duration: ${firstReq.duration.toFixed(2)}ms`);
        console.log(`Status: ${firstReq.status}`);

        // Sequential requests
        console.log("\n--- Sequential Requests (Warm) ---");
        const samples: number[] = [];
        for (let i = 0; i < 5; i++) {
            const req = await makeRequest();
            if (req.status === 200) {
                samples.push(req.duration);
                process.stdout.write(`.`);
            } else {
                process.stdout.write(`x`);
                console.error(`Request failed: ${req.status} ${req.error}`);
            }
        }
        console.log("");

        if (samples.length > 0) {
            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            const min = Math.min(...samples);
            const max = Math.max(...samples);
            console.log(`Average: ${avg.toFixed(2)}ms`);
            console.log(`Min: ${min.toFixed(2)}ms`);
            console.log(`Max: ${max.toFixed(2)}ms`);
        } else {
            console.log("No successful warm requests.");
        }

    } finally {
        console.log("Stopping server...");
        serverProcess.kill();
    }
}

runBenchmark().catch(console.error);
