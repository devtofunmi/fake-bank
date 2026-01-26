import { db } from "./db";
import { scheduledJobs, sessions } from "./schema";
import { eq, lt, and } from "drizzle-orm";
import { transferMoney } from "./wallet";

// 6. Cron executes deterministic logic
export async function processScheduledJobs() {
    console.log("Cron: Checking for pending jobs...");

    // 1. Fetch pending jobs that are due
    const jobs = await db.query.scheduledJobs.findMany({
        where: and(
            eq(scheduledJobs.status, "pending"),
            lt(scheduledJobs.runAt, new Date())
        ),
    });

    for (const job of jobs) {
        try {
            // 2. Mark as processing (Idempotency check part 1)
            await db
                .update(scheduledJobs)
                .set({ status: "processing" })
                .where(eq(scheduledJobs.id, job.id));

            // 3. Execute logic based on type
            if (job.type === "transfer") {
                const payload = JSON.parse(job.payload || "{}");
                const { senderId, receiverId, amount } = payload;

                if (senderId && receiverId && amount) {
                    await transferMoney(senderId, receiverId, amount);
                }
            }

            // 4. Mark as completed
            await db
                .update(scheduledJobs)
                .set({ status: "completed" })
                .where(eq(scheduledJobs.id, job.id));

            console.log(`Job ${job.id} (${job.type}) completed.`);
        } catch (error) {
            console.error(`Job ${job.id} failed:`, error);

            // 5. Mark as failed (for later retry logic if needed)
            await db
                .update(scheduledJobs)
                .set({ status: "failed" })
                .where(eq(scheduledJobs.id, job.id));
        }
    }
}

// 6. Security cleanup
export async function cleanupSessions() {
    console.log("Cron: Cleaning up expired sessions...");
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// Function to schedule a new job
export async function scheduleJob(type: string, payload: object, runAt: Date) {
    await db.insert(scheduledJobs).values({
        type,
        payload: JSON.stringify(payload),
        runAt,
        status: "pending",
    });
}