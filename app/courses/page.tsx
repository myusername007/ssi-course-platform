import { prisma } from "../../lib/prisma";
import CoursesClient from "../../components/CoursesClient";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <CoursesClient courses={courses} />
    </main>
  );
}
