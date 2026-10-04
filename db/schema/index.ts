import { defineRelations } from "drizzle-orm";
import { achievements, userAchievements } from "./achievements";
import { courses } from "./courses";
import { enrollments } from "./enrollments";
import { lessons } from "./lessons";
import { progress } from "./progress";
import { users } from "./users";

export {
  achievements,
  courses,
  enrollments,
  lessons,
  progress,
  userAchievements,
  users,
};

export const relations = defineRelations(
  {
    achievements,
    courses,
    enrollments,
    lessons,
    progress,
    userAchievements,
    users,
  },
  (r) => ({
    achievements: {
      userAchievements: r.many.userAchievements(),
    },
    courses: {
      enrollments: r.many.enrollments(),
      lessons: r.many.lessons(),
    },
    enrollments: {
      user: r.one.users({
        from: r.enrollments.userId,
        to: r.users.id,
      }),
      course: r.one.courses({
        from: r.enrollments.courseId,
        to: r.courses.id,
      }),
    },
    lessons: {
      course: r.one.courses({
        from: r.lessons.courseId,
        to: r.courses.id,
      }),
      progress: r.many.progress(),
    },
    progress: {
      user: r.one.users({
        from: r.progress.userId,
        to: r.users.id,
      }),
      lesson: r.one.lessons({
        from: r.progress.lessonId,
        to: r.lessons.id,
      }),
    },
    users: {
      enrollments: r.many.enrollments(),
      progress: r.many.progress(),
      userAchievements: r.many.userAchievements(),
    },
    userAchievements: {
      user: r.one.users({
        from: r.userAchievements.userId,
        to: r.users.id,
      }),
      achievement: r.one.achievements({
        from: r.userAchievements.achievementId,
        to: r.achievements.id,
      }),
    },
  }),
);
