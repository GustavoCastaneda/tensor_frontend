import Link from "next/link";
import { SlashIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface WorkspaceBreadcrumbProps {
  workspaceName?: string;
  workspaceId?: string;
  isLoading?: boolean;
  currentPage: string;
}

export function WorkspaceBreadcrumb({ 
  workspaceName, 
  workspaceId, 
  isLoading, 
  currentPage 
}: WorkspaceBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="text-gray-400">
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <SlashIcon className="h-4 w-4 text-gray-400" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          {isLoading ? (
            <span className="text-gray-400">Cargando...</span>
          ) : workspaceName ? (
            <BreadcrumbLink asChild className="text-gray-400 transition-colors">
              <Link href={`/workspaces/${encodeURIComponent(workspaceId || '')}`}>
                {workspaceName}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="text-gray-700">{workspaceId || "Workspace"}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <SlashIcon className="h-4 w-4 text-gray-400" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-black font-medium">{currentPage}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
