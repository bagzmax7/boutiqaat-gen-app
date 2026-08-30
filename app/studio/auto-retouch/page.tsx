'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import AutoRetouchLauncher from '@/components/apps/AutoRetouchLauncher';

export default function AutoRetouchPage() {
  return (
    <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-[#a3e635] selection:text-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
          <AutoRetouchLauncher />
        </main>
      </div>
    </div>
  );
}
