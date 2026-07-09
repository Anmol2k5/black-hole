'use client';

import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  
  const getTitle = () => {
    if (pathname === '/upload') return 'Upload Data';
    if (pathname === '/sources') return 'Raw Sources';
    if (pathname.startsWith('/wiki')) return 'Company Wiki';
    if (pathname === '/ask') return 'Ask the Brain';
    if (pathname === '/jobs') return 'Background Jobs';
    return 'Dashboard';
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-6 z-10 sticky top-0">
      <h2 className="text-lg font-medium">{getTitle()}</h2>
      <div className="ml-auto flex items-center space-x-4">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
          A
        </div>
      </div>
    </header>
  );
}
