'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, KeyRound, LogOut, Pencil, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

type AppUser = {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  role: string;
  department?: string;
};

function roleLabel(role?: string) {
  if (role === 'admin') return '管理员';
  if (role === 'super_admin') return '超级管理员';
  if (role === 'finance') return '财务';
  return '普通用户';
}

export default function MobileProfilePage({ user }: { user?: AppUser }) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [displayUsername, setDisplayUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = useMemo(() => {
    return (displayName || displayUsername || '我').trim().slice(0, 1);
  }, [displayName, displayUsername]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login?next=/mobile');
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; data?: { avatar?: string }; error?: string };
      if (!response.ok || !result.success || !result.data?.avatar) {
        throw new Error(result.error || '头像上传失败');
      }
      setAvatar(result.data.avatar);
    } catch (error) {
      alert(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    if (!username.trim()) {
      alert('用户名不能为空');
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: username.trim(),
          name: name.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '修改资料失败');
      }
      setDisplayUsername(username.trim());
      setDisplayName(name.trim());
      setProfileOpen(false);
      alert('资料已修改');
    } catch (error) {
      alert(error instanceof Error ? error.message : '修改资料失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!user?.id) return;
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写完整密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      alert('新密码至少 6 位');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          oldPassword,
          newPassword,
        }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '修改密码失败');
      }
      alert('密码已修改，请重新登录');
      await logout();
    } catch (error) {
      alert(error instanceof Error ? error.message : '修改密码失败');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={avatarInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => void uploadAvatar(event.target.files?.[0])}
      />

      <section className="mobile-ios-glass rounded-[34px] p-5 text-slate-950">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-blue-600 text-3xl font-bold text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/55"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {avatar ? (
              <img src={avatar} alt="头像" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 shadow">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold">{displayName || displayUsername || '用户'}</div>
            <div className="mt-1 truncate text-sm text-slate-600">{displayUsername || '-'}</div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/[0.58] px-3 py-1 text-xs text-slate-600 backdrop-blur-xl">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel(user?.role)}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/90 p-2 shadow-sm backdrop-blur">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[24px] px-4 py-4 text-left active:bg-slate-100"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Camera className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-950">修改头像</span>
            <span className="mt-0.5 block text-sm text-slate-500">上传自己的聊天头像</span>
          </span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[24px] px-4 py-4 text-left active:bg-slate-100"
          onClick={() => {
            setUsername(displayUsername);
            setName(displayName);
            setProfileOpen(true);
          }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Pencil className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-950">修改用户名</span>
            <span className="mt-0.5 block text-sm text-slate-500">修改登录名和显示姓名</span>
          </span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[24px] px-4 py-4 text-left active:bg-slate-100"
          onClick={() => setPasswordOpen(true)}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <KeyRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-950">修改密码</span>
            <span className="mt-0.5 block text-sm text-slate-500">修改后需要重新登录</span>
          </span>
        </button>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/90 p-2 shadow-sm backdrop-blur">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[24px] px-4 py-4 text-left text-red-600 active:bg-red-50"
          onClick={() => void logout()}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <LogOut className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold">退出登录</span>
        </button>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/70 p-4 text-sm text-slate-500 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 text-slate-700">
          <UserRound className="h-4 w-4 text-blue-600" />
          当前账号信息
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between gap-4">
            <span>姓名</span>
            <span className="truncate font-medium text-slate-900">{displayName || '-'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>用户名</span>
            <span className="truncate font-medium text-slate-900">{displayUsername || '-'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>部门</span>
            <span className="truncate font-medium text-slate-900">{user?.department || '-'}</span>
          </div>
        </div>
      </section>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-[30px]">
          <DialogHeader>
            <DialogTitle>修改用户名</DialogTitle>
            <DialogDescription>保存后会同步到后台用户资料。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input className="h-12 rounded-2xl text-base" value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input className="h-12 rounded-2xl text-base" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setProfileOpen(false)} disabled={savingProfile}>
              取消
            </Button>
            <Button className="rounded-2xl bg-blue-600" onClick={saveProfile} disabled={savingProfile}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-[30px]">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>请输入原密码和新密码。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>原密码</Label>
              <Input type="password" className="h-12 rounded-2xl text-base" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input type="password" className="h-12 rounded-2xl text-base" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input type="password" className="h-12 rounded-2xl text-base" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setPasswordOpen(false)} disabled={savingPassword}>
              取消
            </Button>
            <Button className="rounded-2xl bg-blue-600" onClick={changePassword} disabled={savingPassword}>
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
