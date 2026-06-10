'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { formatChinaDate } from '@/lib/china-time';

interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  manager: string;
  status: string;
  created_at: string;
}

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    parent_id: '',
    manager: '',
    status: '正常运营',
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      if (data.success) {
        setDepartments(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.name) {
      return;
    }

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDepartment.name,
          parent_id: newDepartment.parent_id ? parseInt(newDepartment.parent_id) : null,
          manager: newDepartment.manager || null,
          status: newDepartment.status,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchDepartments();
        setIsDialogOpen(false);
        setNewDepartment({
          name: '',
          parent_id: '',
          manager: '',
          status: '正常运营',
        });
      }
    } catch (error) {
      console.error('Failed to add department:', error);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case '正常运营':
        return 'default';
      case '已停用':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // 统计
  const totalDepartments = departments.length;
  const activeDepartments = departments.filter(d => d.status === '正常运营').length;
  const inactiveDepartments = departments.filter(d => d.status === '已停用').length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">部门管理</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 h-9">
              + 新增部门
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">新增部门</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  部门名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  placeholder="请输入部门名称"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="parent" className="text-right">
                  上级部门
                </Label>
                <Select
                  value={newDepartment.parent_id}
                  onValueChange={(value) => setNewDepartment({ ...newDepartment, parent_id: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="选择上级部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无（顶级部门）</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manager" className="text-right">
                  负责人
                </Label>
                <Input
                  id="manager"
                  value={newDepartment.manager}
                  onChange={(e) => setNewDepartment({ ...newDepartment, manager: e.target.value })}
                  placeholder="请输入负责人"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  状态
                </Label>
                <Select
                  value={newDepartment.status}
                  onValueChange={(value) => setNewDepartment({ ...newDepartment, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="正常运营">正常运营</SelectItem>
                    <SelectItem value="已停用">已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddDepartment}>确定</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">部门总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalDepartments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">正常运营</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDepartments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">已停用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-500">{inactiveDepartments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">员工总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{departments.length * 15}</div>
          </CardContent>
        </Card>
      </div>

      {/* Department Table */}
      <Card>
        <CardHeader>
          <CardTitle>部门列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部门名称</TableHead>
                <TableHead>上级部门</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => {
                const parent = dept.parent_id ? departments.find(d => d.id === dept.parent_id) : null;
                return (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{parent?.name || '-'}</TableCell>
                    <TableCell>{dept.manager || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(dept.status)}>
                        {dept.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dept.created_at ? formatChinaDate(dept.created_at) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
