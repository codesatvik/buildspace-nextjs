import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() { 

    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized", { status: 401 });
        }
        const user = await db.query.users.findFirst({
            where: { clerkId: userId }
        });
        if (!user) {
            return new NextResponse("user not found", { status: 404 });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completedLessons = await db.query.progress.findMany({
            where: {
                userId: user.id,
                completed: true,
            }
        });

        
        const completedDates = new Set<string>();
        completedLessons.forEach((lesson) => {
            if (lesson.completedAt) {
                const completedDate = new Date(lesson.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                completedDates.add(completedDate.toISOString());;
            }
        });

        let currentStreak = 0;
        let checkDate = new Date(today);

        while (true) { 
            const dataStr = checkDate.toISOString();
            if (completedDates.has(dataStr)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else { 
                break;
            }
        }
        if (currentStreak !== user.currentStreak) { 
            await db.update(users).set({
                currentStreak: currentStreak,
                longestStreak: Math.max(currentStreak, user.longestStreak),

            })
                .where(eq(users.id, user.id));
        }
        return NextResponse.json({
            currentStreak,
            longestStreak: Math.max(currentStreak, user.longestStreak),
        });
        
        


    } catch (error) { 
        console.error("Error fetching streak:", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}