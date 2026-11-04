import { prisma } from "@/lib/db";
import Chat from "@/components/Chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: { project?: string } }) {
  const sheets = await prisma.factSheet.findMany({ orderBy: { project: "asc" } });
  const reras = sheets.map((s) => `${s.title}: ${s.rera}`);
  return (
    <Chat
      initialProject={searchParams.project === "PROJECT_2" ? "PROJECT_2" : searchParams.project === "PROJECT_1" ? "PROJECT_1" : undefined}
      reras={reras}
    />
  );
}
