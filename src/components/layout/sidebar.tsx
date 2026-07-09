'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, FileText, BookOpen, MessageSquare, Activity, BrainCircuit } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Sources', href: '/sources', icon: FileText },
  { name: 'Wiki', href: '/wiki', icon: BookOpen },
  { name: 'Ask AI', href: '/ask', icon: MessageSquare },
  { name: 'Jobs', href: '/jobs', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col z-10">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-lg">
          <BrainCircuit className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-semibold text-lg tracking-tight">Company Brain</h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 mt-auto border-t border-border/50">
        <div className="text-xs text-muted-foreground">
          MVP v0.1.0 &copy; 2026
        </div>
      </div>
    </div>
  );
}
