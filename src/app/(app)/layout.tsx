import Sidebar from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";

/**
 * Shell layout for all authenticated pages.
 * Wraps content with the role-aware sidebar and top bar.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
