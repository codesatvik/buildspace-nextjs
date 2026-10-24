import { db } from "@/db/drizzle";
import { enrollments, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("unauth", { status: 401 });
    }
    const user = await db.query.users.findFirst({
        where: {
            clerkId: userId,
        }
    });
    if (!user) {
      return NextResponse.json([]);
    }
    const allCourses = await db.query.courses.findMany({
      with: {
        lessons: true,
        enrollments: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    const formattedCourses = allCourses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      duration: course.duration,
      points: course.points,
      totalLessons: course.lessons.length,
      enrolled: course.enrollments.length > 0,
      progress: 0,
    }));
    return NextResponse.json(formattedCourses);
  } catch (e) {
    return e;
  }
}
