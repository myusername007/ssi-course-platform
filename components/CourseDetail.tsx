"use client";

import Link from "next/link";
import { useCourseRegistration } from "../hooks/useCourseRegistration";

export interface CourseDetailItem {
  id: number;
  title: string;
  description: string;
  longDescription: string;
  level: string | null;
  duration: string | null;
  schedule: string | null;
}

export default function CourseDetail({ course }: { course: CourseDetailItem }) {
  const { registered, state, error, canRegister, register } = useCourseRegistration(course.id);

  let label = "Записатися на курс";
  if (registered) label = "Ви записані";
  else if (state === "pending") label = "Підтвердження транзакції...";
  const disabled = !canRegister || registered || state === "pending";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm font-medium text-accent hover:opacity-80">
        ← Усі курси
      </Link>

      <div className="mt-6 rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
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

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{course.title}</h1>
        <p className="mt-3 whitespace-pre-line text-base leading-7 text-muted">{course.longDescription}</p>

        {course.schedule && (
          <p className="mt-6 text-sm text-foreground">
            <span className="font-medium">Розклад:</span> {course.schedule}
          </p>
        )}

        <div className="mt-8">
          <button
            onClick={register}
            disabled={disabled}
            title={!canRegister ? "Спершу підтвердіть SSI-верифікацію" : undefined}
            className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed sm:w-auto"
          >
            {label}
          </button>
          {!canRegister && (
            <p className="mt-3 text-sm text-muted">
              Підключіть MetaMask і підтвердіть SSI-верифікацію на головній сторінці, щоб записатися.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
