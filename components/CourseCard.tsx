"use client";

import Link from "next/link";
import { useCourseRegistration } from "../hooks/useCourseRegistration";

export interface CourseListItem {
  id: number;
  title: string;
  description: string;
  level: string | null;
  duration: string | null;
  schedule: string | null;
}

export default function CourseCard({ course }: { course: CourseListItem }) {
  const { registered, state, canRegister, register } = useCourseRegistration(course.id);

  let label = "Записатися";
  if (registered) label = "Ви записані";
  else if (state === "pending") label = "Підтвердження...";
  const disabled = !canRegister || registered || state === "pending";

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
      <div className="flex flex-wrap gap-2">
        {course.level && (
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            {course.level}
          </span>
        )}
        {course.duration && (
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            {course.duration}
          </span>
        )}
      </div>

      <div className="flex-grow">
        <Link href={`/courses/${course.id}`} className="text-lg font-semibold text-foreground hover:text-accent">
          {course.title}
        </Link>
        <p className="mt-2 text-sm text-muted">{course.description}</p>
      </div>

      {course.schedule && <p className="text-xs text-muted">{course.schedule}</p>}

      <div className="flex items-center gap-3">
        <Link
          href={`/courses/${course.id}`}
          className="text-sm font-medium text-accent hover:opacity-80"
        >
          Детальніше →
        </Link>
        <button
          onClick={register}
          disabled={disabled}
          title={!canRegister ? "Спершу підтвердіть SSI-верифікацію" : undefined}
          className="ml-auto rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
