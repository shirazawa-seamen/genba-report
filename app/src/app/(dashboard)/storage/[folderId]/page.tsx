import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { getStorageFolder, getFolderContents } from "../actions";
import { StoragePage } from "@/components/storage/StoragePage";
import { notFound } from "next/navigation";

export default async function StorageFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const { role, user } = await requireUserContext();

  const [folderResult, contentsResult] = await Promise.all([
    getStorageFolder(folderId),
    getFolderContents(folderId),
  ]);

  if (!folderResult.success || !folderResult.folder) {
    notFound();
  }

  return (
    <StoragePage
      folders={contentsResult.childFolders ?? []}
      documents={contentsResult.documents ?? []}
      breadcrumbs={folderResult.breadcrumbs ?? []}
      currentFolder={folderResult.folder}
      userRole={role}
      userId={user.id}
    />
  );
}
