import { prisma } from "../lib/prisma";
import WalletBar from "../components/WalletBar";
import CourseCard from "../components/CourseCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <WalletBar />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </main>
  );
}
