import { db } from "@/db/drizzle";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized", { status: 401 });
        }

        const { courseId } = await params;
        const user = await db.query.users.findFirst({
            where: { clerkId: userId },
        });
        if (!user) {
            return new NextResponse("user not found", { status: 404 });
        }

        const course = await db.query.courses.findFirst({
            where: { id: courseId },
            with: {
                lessons: {
                    orderBy: (lessons, { asc }) => [asc(lessons.order)],
                },
            },
        });
        if (!course) {
            return new NextResponse("course not found", { status: 404 });
        }

        const enrollment = await db.query.enrollments.findFirst({
            where: {
                userId: user.id,
                courseId: course.id,
            },
        });
        const userProgress = await db.query.progress.findMany({
            where: { userId: user.id },
        });
        const completedLessonIds = new Set(
            userProgress
                .filter((progress) => progress.completed)
                .map((progress) => progress.lessonId),
        );
        const lessonWithProgress = course.lessons.map((lesson) => ({
            ...lesson,
            completed: completedLessonIds.has(lesson.id),
        }));

        return NextResponse.json({
            ...course,
            lessons: lessonWithProgress,
            enrolled: !!enrollment,
            completed: enrollment?.completed ?? false,
        });
    } catch (error) {
        console.error("[course_get]", error);
        return NextResponse.json(
            { error: "failed to load course" },
            { status: 500 },
        );
    }
}
