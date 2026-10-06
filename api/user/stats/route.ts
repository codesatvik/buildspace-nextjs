import { db } from "@/db/drizzle";
import { calculateLevel, calculateNextLevelPoints } from "@/lib/utils";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized", { status: 401 });
        }
        const clerkUser = await currentUser();
        const username =
            clerkUser?.username || clerkUser?.emailAddresses[0]?.emailAddress?.split("@")[0] || "learner";

        const dbUser = await db.query.users.findFirst({
            where: { clerkId: userId },
        });

        if (!dbUser) {
            return NextResponse.json({
                username,
                level: 1,
                totalXP: 0,
                currentStreak: 0,
                longestStreak: 0,
                nextLevelPoints: 1000,
                courseInProgress: 0,
                completedCourses: 0,
                totalLessonsCompleted: 0,
                todayProgress: 0,
                todayCompleted: 0,
                remainingToday: 3,
                recentActivity: [],
            });
        }

        const allEnrollments = await db.query.enrollments.findMany({
            where: { userId: dbUser.id },
        });
        const completedCourses = allEnrollments.filter((e) => e.completed).length;
        const courseInProgress = allEnrollments.filter((e) => !e.completed).length;

        const completedLessons = await db.query.progress.findMany({
            where: { userId: dbUser.id, completed: true },
            with: {
                lesson: {
                    with: {
                        course: true,
                    }
                }
            },
            orderBy: { completedAt: "desc" },
        });
        const totalLessonsCompleted = completedLessons.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0)
        const todayCompleted = completedLessons.filter((p) => {
            if (!p.completedAt) return false;
            const completedDate = new Date(p.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === today.getTime();

        }).length;
        const dailyGoal = 3;
        const todayProgress = Math.min(
            Math.round((todayCompleted / dailyGoal) * 100),
        );
        const remainingToday = Math.max(dailyGoal - todayCompleted, 0);

        const recentActivity = completedLessons.flatMap((p) => {
            if (!p.lesson || !p.lesson.course) {
                return [];
            }

            return [{
                id: p.id,
                title: p.lesson.title,
                courseTitle: p.lesson.course.title,
                completedAt: p.completedAt,
            }];
        }).slice(0, 5);
        const level = calculateLevel(dbUser.points);
        const nextLevelPoints = calculateNextLevelPoints(dbUser.points);

        return NextResponse.json({
            username,
            level,
            totalXP: dbUser.points,
            nextLevelPoints,
            currentStreak: dbUser.currentStreak,
            longestStreak: dbUser.longestStreak,
            totalLessonsCompleted,
            courseInProgress,
            completedCourses,
            todayProgress,
            todayCompleted,
            remainingToday,
            recentActivity,
        });
    } catch (error) {
        console.error("[UNIFIED_STATS]", error);
        return NextResponse.json(
            { error: "failed to load user stats" },
            { status: 500 },
        );
    }
}