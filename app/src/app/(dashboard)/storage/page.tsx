import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { getRootFolders } from "./actions";
import { StoragePage } from "@/components/storage/StoragePage";

export default async function StorageRootPage() {
  const { role, user } = await requireUserContext();

  let folders: Awaited<ReturnType<typeof getRootFolders>>["folders"] = [];
  try {
    const result = await getRootFolders();
    folders = result.folders ?? [];
  } catch (error) {
    console.error("[StorageRootPage] getRootFolders error:", error);
  }

  return (
    <StoragePage
      folders={folders ?? []}
      documents={[]}
      breadcrumbs={[]}
      currentFolder={null}
      userRole={role}
      userId={user.id}
    />
  );
}
