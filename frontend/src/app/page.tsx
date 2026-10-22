import { redirect } from "next/navigation";

/** Entry point is the login / create-account screen. */
export default function HomePage() {
  redirect("/login");
}
