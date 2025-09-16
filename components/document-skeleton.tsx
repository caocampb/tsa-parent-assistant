import { Skeleton } from "@/components/ui/skeleton";

export function DocumentSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Size</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Uploaded</th>
            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i} className="border-b">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-md" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-32" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
