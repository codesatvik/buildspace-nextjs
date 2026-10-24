import { db } from "@/db/drizzle";
import { enrollments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> },) { 
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized")
        }
        const { courseId } = await params;
        const user = await db.query.users.findFirst({
            where: { clerkId: userId },
        })
        if (!user) { 
            return new NextResponse("user not found")
        }
        const course = await db.query.courses.findFirst({
            where: { id: courseId },
        });
        if (!course) { 
            return new NextResponse("course not found")
        }
        const existingEnrollment = await db.query.enrollments.findFirst({
            where: {
                userId: user.id,
                courseId: course.id
            }
        })
        if (existingEnrollment) { 
            return NextResponse.json({
                message: "already enrolled",
                enrollment: existingEnrollment,
                enrolled: true,
            });
        }
        const enrollment = await db
            .insert(enrollments)
            .values({
                userId: user.id,
                courseId: course.id,
                enrolledAt: new Date(),
                completed: false,
            })
            .returning();
        return NextResponse.json({
            success: true,
            enrollment: enrollment[0], 
            message: "successfully enrolled in course",
        })
    } catch (error) { 
        return new NextResponse("unauth")
    }
}
 
export async function DELETE(req: Request, { params}: { params: Promise<{ courseId: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("unauthorized")
        }
        const { courseId } = await params;
        const user = await db.query.users.findFirst({
            where: { clerkId: userId },
        })
        if (!user) {
            return new NextResponse("user not found")
        }
        await db.delete(enrollments).where(
            and(
                eq(enrollments.userId, user.id),
                eq(enrollments.courseId, courseId),
            )
        )
        return NextResponse.json({
            success: true,
            message: "successfully unenrolled from course",
        })

    } catch (error) { 
        return new NextResponse("unauth")
    }
} 