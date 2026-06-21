'use client';

/**
 * app/bundling/page.tsx
 *
 * Boutiqaat Interactive Bundling Studio — Google Flow Edition.
 * Embeds the Flow interactive canvas layout studio within the dashboard.
 */

import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import FlowApp from './flow code/App';

export default function BundlingStudioPage() {
  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 min-h-0 overflow-hidden bg-[#0e0e0e]">
          <FlowApp />
        </div>
      </div>
    </div>
  );
}
