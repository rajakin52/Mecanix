import type { ReactNode } from 'react';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white p-4">
        <h1 className="mb-8 text-xl font-bold text-primary-700">MECANIX</h1>
        <p className="text-xs uppercase text-gray-400">Insurance Portal</p>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
