import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      id="main-content"
      role="main"
      className="min-h-[70vh] flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Page Not Found / Ukurasa Haukupatikana
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The requested clinical resource or route does not exist or has been relocated.
          Please return to the main clinical workspace.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm rounded-lg transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-[44px]"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Return to Dashboard / Rudi Nyumbani</span>
        </Link>
      </div>
    </main>
  );
}
