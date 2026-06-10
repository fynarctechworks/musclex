'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, User } from 'lucide-react';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { admin, logout } = useAuthStore();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation menu"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger className="ml-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted transition-colors outline-none">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[11px]">
              {admin ? getInitials(admin.name) : 'AD'}
            </AvatarFallback>
          </Avatar>
          <span>{admin?.name || 'Admin'}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
