'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Grid3X3, ChevronDown, Menu, LogOut, User, KeyRound } from 'lucide-react';
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
    role: string;
    department?: string;
  };
}

export function Header({ onToggleSidebar, user }: HeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  // 个人设置对话框
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  
  // 修改密码对话框
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
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

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'user':
        return '普通用户';
      default:
        return role;
    }
  };
  
  // 打开个人设置对话框
  const handleOpenProfile = () => {
    setNewUsername(user?.username || '');
    setNewName(user?.name || '');
    setProfileDialogOpen(true);
  };
  
  // 保存个人设置
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
          username: newUsername,
          name: newName
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: '成功', description: '个人设置已更新' });
        setProfileDialogOpen(false);
        // 更新本地用户信息
        if (typeof window !== 'undefined') {
          localStorage.setItem('username', newUsername);
        }
        // 发送通知
        if (user?.username !== newUsername) {
          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '账号信息变更通知',
              content: `您的账号已变更：新用户名为 "${newUsername}"`,
              receiverIds: [user?.id],
              sendEmail: true
            })
          });
        }
        // 更新显示的用户名和姓名
        setNewUsername(newUsername);
        setNewName(newName);
      } else {
        toast({ title: '错误', description: data.error || '更新失败', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: '错误', description: '网络错误', variant: 'destructive' });
    } finally {
      setProfileLoading(false);
    }
  };
  
  // 打开修改密码对话框
  const handleOpenPassword = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogOpen(true);
  };
  
  // 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: '错误', description: '请填写所有字段', variant: 'destructive' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ title: '错误', description: '两次输入的新密码不一致', variant: 'destructive' });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ title: '错误', description: '密码长度至少6位', variant: 'destructive' });
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
          newPassword
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: '成功', description: '密码已修改，请重新登录' });
        setPasswordDialogOpen(false);
        // 发送通知
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '密码修改通知',
            content: '您的账号密码已修改，如非本人操作请立即联系管理员。',
            receiverIds: [user?.id],
            sendEmail: true
          })
        });
        // 退出登录
        handleLogout();
      } else {
        toast({ title: '错误', description: data.error || '修改失败', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: '错误', description: '网络错误', variant: 'destructive' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">聚</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">聚星数据平台</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索..."
              className="w-48 pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Notifications */}
        <NotificationBell userId={user?.id || 0} userName={user?.name || ''} />

        {/* Apps Menu */}
        <Button variant="ghost" size="icon" className="hidden md:flex">
          <Grid3X3 className="w-5 h-5 text-slate-600" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src="/avatar.jpg" />
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm text-slate-700">
                {user?.name || '用户'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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

        {/* Toggle Sidebar */}
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden">
          <Menu className="w-5 h-5 text-slate-600" />
        </Button>
      </div>

        {/* 个人设置对话框 */}
        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>个人设置</DialogTitle>
              <DialogDescription>修改您的个人信息</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>当前用户名</Label>
                <Input value={user?.username || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>新用户名</Label>
                <Input 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="输入新用户名" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>取消</Button>
              <Button onClick={handleSaveProfile} disabled={profileLoading}>
                {profileLoading ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 修改密码对话框 */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
              <DialogDescription>修改您的登录密码</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>原密码</Label>
                <Input 
                  type="password"
                  value={oldPassword} 
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="输入原密码" 
                />
              </div>
              <div className="space-y-2">
                <Label>新密码</Label>
                <Input 
                  type="password"
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）" 
                />
              </div>
              <div className="space-y-2">
                <Label>确认新密码</Label>
                <Input 
                  type="password"
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>取消</Button>
              <Button onClick={handleChangePassword} disabled={passwordLoading}>
                {passwordLoading ? '修改中...' : '确认修改'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        

      </header>
  );
}
