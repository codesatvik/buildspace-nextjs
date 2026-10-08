import { db } from "@/db/drizzle";
import { achievements, userAchievements, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() { 
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized", { status: 401 })
        }
        let dbUser = await db.query.users.findFirst({
            where: users.clerkId.userId

        });
        if (!dbUser) {
            return new NextResponse("user not found")
        }
        const allAchievements = await db.query.achievements.findMany();
        const userAchievementsList = await db.query.userAchievements.findMany({
            where: eq(userAchievements.userId, dbUser.id)
        })
        const earnedAchievementsIds = new Set(
            userAchievementsList.map((ua) => ua.achievementId),
        )
        const achievementsWithStatus = allAchievements.map((achievements) => ({
            ...achievements,
            earned: earnedAchievementsIds.has(achievements.id),
            earnedAt: userAchievementsList.find(
                (ua) => ua.achievementId === achievements.id,
            )?.earnedAt,
        }));
        return NextResponse.json(achievementsWithStatus)
    } catch (error) {
        console.error("Error fetching user achievements:", error);
        return new NextResponse("Internal error")
    }
}