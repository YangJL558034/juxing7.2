'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChinaDate } from '@/lib/china-time';

interface Task {
  id: number;
  name: string;
  type: string;
  priority: string;
  status: string;
  end_date: string;
  owner: string;
  department: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    priority: '中',
    status: '进行中',
    end_date: '',
    owner: '',
    remark: '',
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          department: '销售部',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        setFormData({
          name: '',
          type: '',
          priority: '中',
          status: '进行中',
          end_date: '',
          owner: '',
          remark: '',
        });
        fetchTasks();
      }
    } catch (error) {
      console.error('创建任务失败:', error);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('确定要删除这个任务吗？')) return;
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
      }
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case '高':
        return 'default';
      case '中':
        return 'secondary';
      case '低':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case '进行中':
      case '已逾期':
        return 'default';
      case '已完成':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return formatChinaDate(dateStr);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-1 border-b border-slate-200">
          <Button
            variant="ghost"
            className="h-10 px-4 text-blue-600 border-b-2 border-blue-600 rounded-none bg-transparent"
          >
            我的任务
          </Button>
          <Button
            variant="ghost"
            className="h-10 px-4 text-slate-600 rounded-none hover:text-slate-800 hover:bg-slate-50"
          >
            我参与的任务
          </Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 h-9 text-sm">
              <Plus className="w-4 h-4 mr-1" />
              添加任务
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>添加任务</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">任务名称 *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">任务类型</Label>
                  <Input id="type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">优先级</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="高">高</SelectItem>
                      <SelectItem value="中">中</SelectItem>
                      <SelectItem value="低">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">状态</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="进行中">进行中</SelectItem>
                      <SelectItem value="已完成">已完成</SelectItem>
                      <SelectItem value="已逾期">已逾期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">截止时间</Label>
                  <Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner">负责人</Label>
                <Input id="owner" value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="remark">备注</Label>
                <Input id="remark" value={formData.remark} onChange={(e) => setFormData({ ...formData, remark: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleCreateTask} disabled={!formData.name}>确定</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Input placeholder="搜索任务名称..." className="h-9" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-28 h-9 hidden sm:flex">
            <SelectValue placeholder="截止时间" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="today">今天</SelectItem>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="overdue">已逾期</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-9 text-sm">
          重置
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="min-w-[200px]">任务名称</TableHead>
                <TableHead className="min-w-[80px]">类型</TableHead>
                <TableHead className="min-w-[80px]">优先级</TableHead>
                <TableHead className="min-w-[100px]">截止时间</TableHead>
                <TableHead className="min-w-[80px]">状态</TableHead>
                <TableHead className="min-w-[80px]">负责人</TableHead>
                <TableHead className="min-w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 cursor-pointer">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      {item.type ? (
                        <Badge variant="outline" className="text-xs h-5 bg-slate-50">
                          {item.type}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getPriorityVariant(item.priority)}
                        className={cn(
                          item.priority === '高' && 'bg-red-100 text-red-700 border-0',
                          item.priority === '中' && 'bg-yellow-100 text-yellow-700 border-0',
                          item.priority === '低' && 'bg-gray-100 text-gray-600 border-0'
                        )}
                      >
                        {item.priority || '中'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(item.end_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(item.status)}
                        className={cn(
                          item.status === '进行中' && 'bg-blue-100 text-blue-700 border-0',
                          item.status === '已逾期' && 'bg-red-100 text-red-700 border-0',
                          item.status === '已完成' && 'bg-green-100 text-green-700 border-0'
                        )}
                      >
                        {item.status || '进行中'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{item.owner || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteTask(item.id)}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
        <span className="text-sm text-slate-600">共 {tasks.length} 条数据</span>
        <div className="flex items-center gap-2">
          <Select defaultValue="10">
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10条/页</SelectItem>
              <SelectItem value="20">20条/页</SelectItem>
              <SelectItem value="50">50条/页</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center">
            <Button variant="outline" size="sm" className="h-8 px-2" disabled>
              &lt;
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 mx-1 bg-blue-50 text-blue-600 border-blue-200"
            >
              1
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2">
              &gt;
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
