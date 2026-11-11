import { AuthPage } from "@/components/auth-page";
export const metadata = { title: "Create your account" };
export default function Page({ searchParams }: PageProps<"/signup">) {
  return <AuthPage mode="signup" searchParams={searchParams as Promise<{ next?: string }>} />;
}
