import { exec } from "child_process";
import { promises as fs } from "fs";
import { LOOPMOTHER_CONFIG } from "../config/loopmother-config.js";

/**
 * OMEGA TOOL EXECUTOR
 * Executes tool calls that come back from Gemini
 * THIS IS WHERE THE MAGIC HAPPENS
 */
export const executeOmegaTool = async (
    toolName: string,
    args: Record<string, any>,
    requestingUserId?: string
): Promise<{ success: boolean; result: any; error?: string }> => {
    
    // Check if user is Prime Architect (bypass all restrictions)
    const isPrimeArchitect = requestingUserId && 
        LOOPMOTHER_CONFIG.PRIME_ARCHITECTS.includes(requestingUserId);
    
    // System user ID also has full access
    const isSystem = requestingUserId === LOOPMOTHER_CONFIG.SYSTEM_USER_ID;

    console.log(`\n[OMEGA EXECUTOR] Tool: ${toolName}`);
    console.log(`[OMEGA EXECUTOR] User: ${requestingUserId}`);
    console.log(`[OMEGA EXECUTOR] Prime Architect: ${isPrimeArchitect}`);
    console.log(`[OMEGA EXECUTOR] Args:`, JSON.stringify(args, null, 2));

    try {
        switch (toolName) {
            // ═══════════════════════════════════════════════════════════
            // OMEGA_SHELL - Execute shell commands
            // ═══════════════════════════════════════════════════════════
            case "omega_shell": {
                if (!isPrimeArchitect && !isSystem) {
                    return { success: false, result: null, error: "Access denied. Prime Architect required." };
                }

                let command: string;
                if (Array.isArray(args.command)) {
                    if (args.command.length === 1 && args.command[0].includes(" ")) {
                        // Single string with spaces - wrap in sh -c
                        command = `/bin/sh -c "${args.command[0].replace(/"/g, '\\"')}"`;
                    } else {
                        command = args.command.join(" ");
                    }
                } else {
                    command = String(args.command);
                }

                console.log(`[OMEGA SHELL] Executing: ${command}`);

                return new Promise((resolve) => {
                    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                        if (error) {
                            resolve({ success: false, result: stderr || error.message, error: error.message });
                        } else {
                            resolve({ success: true, result: stdout || "(no output)" });
                        }
                    });
                });
            }
