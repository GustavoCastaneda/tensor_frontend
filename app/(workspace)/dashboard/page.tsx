"use client";

import { WorkspaceOverview } from "@/src/components/WorkspaceOverview";
import { DashboardChatForm } from "@/src/components/DashboardChatForm";
import { ChatResults } from "@/src/components/ChatResults";
import { useDashboardChat } from "@/src/hooks/useDashboardChat";
import { HelloUser } from "@/components/ui/HelloUser";

export default function Dashboard() {
  const { resp, callChat } = useDashboardChat();

  return (
    <div className="pt-[60px] pl-[50px] space-y-8">
      <HelloUser />
      <WorkspaceOverview />
      {/* <DashboardChatForm /> */}
      <ChatResults resp={resp} onRetryWithColumns={(columns) => callChat({ force_columns: columns })} />
    </div>
  );
}