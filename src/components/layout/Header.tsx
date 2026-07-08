'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ChevronDown, Grid3X3, KeyRound, LogOut, Menu, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from './NotificationBell';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
  onToggleSidebar?: () => void;
  user?: {
    id: number;
    username: string;
    name: string;
    avatar?: string;
    role: string;
    department?: string;
  };
}

function initials(value?: string) {
  return (value || 'U').trim().slice(0, 1).toUpperCase();
}

export function Header({ onToggleSidebar, user }: HeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleOpenProfile = () => {
    setNewUsername(user?.username || '');
    setNewName(user?.name || '');
    setProfileDialogOpen(true);
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || '头像上传失败');
      }

      toast({ title: '成功', description: '头像已更新' });
      router.refresh();
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '头像上传失败',
        variant: 'destructive',
      });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!newUsername.trim()) {
      toast({ title: '错误', description: '用户名不能为空', variant: 'destructive' });
      return;
    }

    setProfileLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          username: newUsername.trim(),
          name: newName.trim(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || '资料更新失败');
      }

      toast({ title: '成功', description: '个人资料已更新' });
      setProfileDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '资料更新失败',
        variant: 'destructive',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenPassword = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: '错误', description: '请填写完整密码信息', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: '错误', description: '两次输入的新密码不一致', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: '错误', description: '密码长度至少 6 位', variant: 'destructive' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          oldPassword,
          newPassword,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || '密码修改失败');
      }

      toast({ title: '成功', description: '密码已修改，请重新登录' });
      setPasswordDialogOpen(false);
      await handleLogout();
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '密码修改失败',
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <input
        ref={avatarInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => void uploadAvatar(event.target.files?.[0])}
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-sm font-bold text-white">聚</span>
          </div>
          <span className="text-lg font-semibold text-slate-800">聚星数据平台</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center md:flex">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="搜索..." className="h-9 w-48 border-slate-200 bg-slate-50 pl-9 focus:bg-white" />
          </div>
        </div>

        <NotificationBell userId={user?.id || 0} userName={user?.name || ''} />

        <Button variant="ghost" size="icon" className="hidden md:flex">
          <Grid3X3 className="h-5 w-5 text-slate-600" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-9 items-center gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar} alt={user?.name || user?.username || '用户头像'} />
                <AvatarFallback className="bg-blue-500 text-xs text-white">
                  {initials(user?.name || user?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-slate-700 md:inline">{user?.name || '用户'}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.department || ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleOpenProfile}>
              <User className="mr-2 h-4 w-4" />
              个人设置
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenPassword}>
              <KeyRound className="mr-2 h-4 w-4" />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden">
          <Menu className="h-5 w-5 text-slate-600" />
        </Button>
      </div>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>个人设置</DialogTitle>
            <DialogDescription>支持在电脑端修改头像、用户名和显示名称。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="relative"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                <Avatar className="h-[4.5rem] w-[4.5rem] border border-slate-200">
                  <AvatarImage src={user?.avatar} alt={user?.name || user?.username || '用户头像'} />
                  <AvatarFallback className="bg-blue-500 text-lg text-white">
                    {initials(user?.name || user?.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                  <Camera className="h-4 w-4" />
                </span>
              </button>
              <div className="text-sm text-slate-500">
                <p>{avatarUploading ? '头像上传中...' : '点击头像即可更换'}</p>
                <p className="mt-1">支持 JPG、PNG、WebP、GIF，大小不超过 5MB。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-username">用户名</Label>
              <Input
                id="profile-username"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                placeholder="输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-name">显示名称</Label>
              <Input
                id="profile-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="输入显示名称"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveProfile} disabled={profileLoading}>
              {profileLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>修改后需要重新登录。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="old-password">原密码</Label>
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                placeholder="输入原密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="输入新密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? '提交中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
