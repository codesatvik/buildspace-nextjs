import { defineRelations } from "drizzle-orm";
import { courses } from "./courses";
import { lessons } from "./lessons";
import { progress } from "./progress";
import { users } from "./users";

export { courses, lessons, progress, users };

export const relations = defineRelations(
  { courses, lessons, progress, users },
  (r) => ({
    courses: {
      lessons: r.many.lessons(),
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
      progress: r.many.progress(),
    },
  }),
);
