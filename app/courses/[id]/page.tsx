import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import CourseDetail from "../../../components/CourseDetail";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <CourseDetail course={course} />
    </main>
  );
}
