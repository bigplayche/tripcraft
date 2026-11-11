import { AuthPage } from "@/components/auth-page";
export const metadata = { title: "Sign in" };
export default function Page({ searchParams }: PageProps<"/login">) {
  return <AuthPage mode="login" searchParams={searchParams as Promise<{ next?: string }>} />;
}
