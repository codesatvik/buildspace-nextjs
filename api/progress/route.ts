import { db } from "@/db/drizzle";
import { enrollments, lessons, progress, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";


export async function POST(req: Request) { 
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized", { status: 401 });
        }
        const body = await req.json();
        const { lessonId, completed } = body;
        let user = await db.query.users.findFirst({
            where: { clerkId: userId }
        })
        if (!user) { 
            return new NextResponse("user not found", {status:403})
        }
        const lesson = await db.query.lessons.findFirst({
            where: { id: lessonId }
        })
        if (!lesson) { 
            return new NextResponse("lesson not found", {status:404})
        }
        const existingEnrollment = await db.query.enrollments.findFirst({
            where: { userId: user.id, courseId: lesson.courseId }
        });

        if (!existingEnrollment) { 
            await db.insert(enrollments).values({
                userId: user.id,
                courseId: lesson.courseId,
                enrolledAt: new Date(),
                completed: false,
            })
        }
        const existingProgress = await db.query.progress.findFirst({
            where: { userId: user.id, lessonId: lessonId }
        })
        if (existingEnrollment) {
            await db
                .update(progress)
                .set({
                    completed,
                    completedAt: completed ? new Date() : null,

                })
                .where(and(eq(progress.userId, user.id), eq(progress.lessonId, lessonId)));
        } else {
            await db.insert(progress).values({
                userId: user.id,
                lessonId: lessonId,
                completed,
                completedAt: completed ? new Date() : null,
            });
        }

        if (completed) { 
            const courseWithLessons = await db.query.courses.findFirst({
                where: { id: lesson.courseId },
                with: {
                    lessons: true,
                },
            });
            if (courseWithLessons) { 
                const pointsPerLesson = Math.floor(
                    courseWithLessons.points / courseWithLessons.lessons.length,
                );
                await db
                    .update(users)
                    .set({
                        points: sql`${users.points} + ${pointsPerLesson}`,
                    })
                        .where(eq(users.id, user.id));
                console.log(`Awarded ${pointsPerLesson} XP for completing lesson`);

            }
            await updateUserStreak(user.id);
            await checkAndAwardAchievements(user.id);
            return NextResponse.json({ success: true });
        }



    } catch (error) { 
        console.error("Error in POST /api/progress:", error);
        return new NextResponse("internal error ")
    }

}

async function updateUserStreak(userId: string) { 
    const completedLessons = await db.query.progress.findMany({
        where: { userId, completed: true },
        orderBy: (progress, {desc}) => [desc(progress.completedAt)],
    })
    if (completedLessons.length === 0) return;
    const completedDates = new Set<string>();
    completedLessons.forEach((lessons) => {
        if (lessons.completedAt) {
            const date = new Date(lessons.completedAt);
            date.setHours(0, 0, 0, 0);
            completedDates.add(date.toISOString());
        }
    });
    const sortedDates = Array.from(completedDates).sort().reverse();
    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastActivityDate = new Date(sortedDates[0]);
    lastActivityDate.setHours(0, 0, 0, 0);

    if (lastActivityDate >= yesterday) { 
        streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
            const currentDate = new Date(sortedDates[i - 1]);
            const previousDate = new Date(sortedDates[i]);
            currentDate.setHours(0, 0, 0, 0);
            previousDate.setHours(0, 0, 0, 0);

            const diffDays =
                (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays === 1) {
                streak++;
            } else {
                break;
            }
        }
            
    }
    await db
        .update(users)
        .set({
            currentStreak: streak,
            longestStreak: sql`GREATEST(${users.longestStreak}, ${streak})`,
            lastActive: new Date(),

        })
        .where(eq(users.id, userId));

    console.log(`streak updated to ${streak} days`);

}
async function checkAndAwardAchievements(userId: string) { 
    
}