import { redirect } from "next/navigation";

// The course catalog now lives at "/" (see app/page.tsx). This route is
// kept only so any existing links to /courses keep working.
export default function CoursesRedirect() {
  redirect("/");
}
