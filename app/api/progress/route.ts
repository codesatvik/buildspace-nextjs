import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import {
  users,
  progress,
  lessons,
  courses,
  userAchievements,
  enrollments,
} from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

async function checkAndAwardAchievements(userId: string) {
  const user = await db.query.users.findFirst({
    where: { id: userId },
  });

  if (!user) return;

  const completedLessonsResult = await db
    .select({ count: count() })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.completed, true)));

  const lessonsCompleted = completedLessonsResult[0]?.count || 0;

  const completedCoursesResult = await db
    .select({ count: count() })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.completed, true)),
    );

  const coursesCompleted = completedCoursesResult[0]?.count || 0;

  const allAchievements = await db.query.achievements.findMany();

  const earnedAchievements = await db.query.userAchievements.findMany({
    where: { userId },
  });

  const earnedIds = new Set(earnedAchievements.map((ea) => ea.achievementId));

  for (const achievement of allAchievements) {
    if (earnedIds.has(achievement.id)) continue;

    let shouldAward = false;
    const criteria = achievement.criteria as any;

    switch (criteria.type) {
      case "lessons_completed":
        if (lessonsCompleted >= criteria.count) shouldAward = true;
        break;
      case "courses_completed":
        if (coursesCompleted >= criteria.count) shouldAward = true;
        break;
      case "streak":
        if (user.currentStreak >= criteria.days) shouldAward = true;
        break;
    }

    if (shouldAward) {
      await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
        earnedAt: new Date(),
      });

      await db
        .update(users)
        .set({ points: sql`${users.points} + ${achievement.points}` })
        .where(eq(users.id, userId));
    }
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { lessonId, completed } = body;

    const user = await db.query.users.findFirst({
      where: { clerkId: userId },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const lesson = await db.query.lessons.findFirst({
      where: { id: lessonId },
    });

    if (!lesson) {
      return new NextResponse("Lesson not found", { status: 404 });
    }

    const existingEnrollment = await db.query.enrollments.findFirst({
      where: { userId: user.id, courseId: lesson.courseId },
    });

    if (!existingEnrollment) {
      await db.insert(enrollments).values({
        userId: user.id,
        courseId: lesson.courseId,
        enrolledAt: new Date(),
        completed: false,
      });
    }

    const existingProgress = await db.query.progress.findFirst({
      where: { userId: user.id, lessonId },
    });

    if (existingProgress) {
      await db
        .update(progress)
        .set({
          completed,
          completedAt: completed ? new Date() : null,
        })
        .where(
          and(eq(progress.userId, user.id), eq(progress.lessonId, lessonId)),
        );
    } else {
      await db.insert(progress).values({
        userId: user.id,
        lessonId,
        completed,
        completedAt: completed ? new Date() : null,
      });
    }

    if (completed) {
      const courseWithLessons = await db.query.courses.findFirst({
        where: { id: lesson.courseId },
        with: { lessons: true },
      });

      if (courseWithLessons) {
        const pointsPerLesson = Math.floor(
          courseWithLessons.points / courseWithLessons.lessons.length,
        );

        await db
          .update(users)
          .set({ points: sql`${users.points} + ${pointsPerLesson}` })
          .where(eq(users.id, user.id));
      }

      await updateUserStreak(user.id);
      await checkAndAwardAchievements(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[PROGRESS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

async function updateUserStreak(userId: string) {
  const completedLessons = await db.query.progress.findMany({
    where: { userId, completed: true },
    orderBy: (progress, { desc }) => [desc(progress.completedAt)],
  });

  if (completedLessons.length === 0) return;

  const uniqueDates = new Set<string>();
  completedLessons.forEach((lesson) => {
    if (lesson.completedAt) {
      const date = new Date(lesson.completedAt);
      date.setHours(0, 0, 0, 0);
      uniqueDates.add(date.toISOString());
    }
  });

  const sortedDates = Array.from(uniqueDates).sort().reverse();

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastActivityDate = new Date(sortedDates[0]);
  lastActivityDate.setHours(0, 0, 0, 0);

  if (lastActivityDate >= yesterday) {
    streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);

      const diffDays =
        (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
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
}
