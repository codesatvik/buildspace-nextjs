import { db } from "@/db/drizzle";
import { auth } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() { 
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized")
        }
        const currentUser = await db.query.users.findFirst({
            where: { clerkId: userId },
        })
        const leaderboardEntireis = await db.query.users.findMany({
            columns: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                points: true,
                level: true,
                currentStreak: true,
            },
            orderBy: (users, { desc }) => desc(users.points),
        })
        const entriesWithRank = leaderboardEntireis.map((entry: typeof leaderboardEntireis[number], index: number) => ({
            ...entry,
            rank: index + 1,
        }))
        let userRank = null;
        let userPoints = 0;
        let userLevel = 1;
        let userStreak = 0;
        if (currentUser) { 
            userRank = entriesWithRank.findIndex((e: typeof entriesWithRank[number]) => e.id === currentUser.id) + 1;
            userPoints = currentUser.points;
            userLevel = currentUser.level;
            userStreak =  currentUser.currentStreak; 
        }
        return NextResponse.json({
            entries: entriesWithRank,
            userRank,
            userPoints,
            userLevel,
            userStreak,
            totalUsers: leaderboardEntireis.length,
        });

    } catch (error) { 
        console.error("[LEADERBOARD_GET]", error);
        return NextResponse.json({
            entries: [],
            userRank: null,
            userPoints: 0,
            userLevel: 1,
            userStreak: 0,
        });
    }
}