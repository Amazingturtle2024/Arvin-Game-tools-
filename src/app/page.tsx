import { AppShell } from "@/components/AppShell";
import { HomeClient } from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell>
      <HomeClient />
    </AppShell>
  );
}
