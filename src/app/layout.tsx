import type { Metadata } from "next";
import { AppShell, type AppShellPublishCta, type AppShellUser } from "@/components/AppShell";
import { getManagerAttentionSnapshot } from "@/lib/manager-workflow";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teamwise",
  description: "Team scheduling, availability, and coverage together.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let appShellUser: AppShellUser | null = null;
  let appShellPublishCta: AppShellPublishCta | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    appShellUser = {
      fullName:
        profile?.full_name ??
        user.user_metadata?.full_name ??
        user.email ??
        "Team member",
      role: profile?.role === "manager" ? "manager" : "therapist",
    };

    if (profile?.role === "manager") {
      const attention = await getManagerAttentionSnapshot(supabase);
      if (attention.publishReady) {
        appShellPublishCta = {
          href: attention.links.publish,
          label: "Publish cycle",
        };
      }
    }
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell user={appShellUser} publishCta={appShellPublishCta}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
