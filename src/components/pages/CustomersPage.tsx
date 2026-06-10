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
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChinaDate } from '@/lib/china-time';

interface Customer {
  id: number;
  name: string;
  level: string;
  source: string;
  phone: string;
  address: string;
  status: string;
  qualifications: string;
  creator: string;
  department: string;
  owner: string;
  created_at: string;
  updated_at: string;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    level: '普通',
    source: '',
    phone: '',
    address: '',
    status: '未成交',
    qualifications: '',
    owner: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('获取客户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creator: '当前用户',
          department: '销售部',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        setFormData({
          name: '',
          level: '普通',
          source: '',
          phone: '',
          address: '',
          status: '未成交',
          qualifications: '',
          owner: '',
        });
        fetchCustomers();
      }
    } catch (error) {
      console.error('创建客户失败:', error);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('确定要删除这个客户吗？')) return;
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchCustomers();
      }
    } catch (error) {
      console.error('删除客户失败:', error);
    }
  };

  const getLevelVariant = (level: string) => {
    switch (level) {
      case '优质客户':
      case 'VIP客户':
        return 'default';
      case '普通客户':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case '已成交':
        return 'default';
      case '跟进中':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return formatChinaDate(dateStr);
  };

  const filteredCustomers = customers.filter(customer => 
    searchPhone ? customer.phone?.includes(searchPhone) : true
  );

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-4 gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="客户状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部客户</SelectItem>
              <SelectItem value="active">活跃客户</SelectItem>
              <SelectItem value="inactive">非活跃客户</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="搜索手机号..." 
              className="w-40 md:w-48 pl-9 h-9"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-9 text-sm">
            高级筛选
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 h-9 text-sm">
                <Plus className="w-4 h-4 mr-1" />
                新建客户
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新建客户</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">客户名称 *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="level">客户级别</Label>
                    <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIP客户">VIP客户</SelectItem>
                        <SelectItem value="优质客户">优质客户</SelectItem>
                        <SelectItem value="普通">普通</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">状态</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="未成交">未成交</SelectItem>
                        <SelectItem value="跟进中">跟进中</SelectItem>
                        <SelectItem value="已成交">已成交</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="source">客户来源</Label>
                    <Input id="source" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">手机号</Label>
                    <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">地址</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="owner">负责人</Label>
                  <Input id="owner" value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qualifications">资质标签</Label>
                  <Input id="qualifications" value={formData.qualifications} onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })} placeholder="多个标签用逗号分隔" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleCreateCustomer} disabled={!formData.name}>确定</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="h-9 text-sm hidden sm:inline-flex">
            查询
          </Button>
        </div>
      </div>

      {/* Filter Tags */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-slate-500 hidden sm:inline">客户筛选：</span>
        <Button variant="secondary" size="sm" className="h-7 text-xs bg-blue-100 text-blue-700 border-0">
          我的客户
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          参与的客户
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="min-w-[120px]">客户名称</TableHead>
                <TableHead className="min-w-[80px]">客户级别</TableHead>
                <TableHead className="min-w-[80px]">客户来源</TableHead>
                <TableHead className="min-w-[100px]">创建时间</TableHead>
                <TableHead className="min-w-[80px]">资质标签</TableHead>
                <TableHead className="min-w-[80px]">状态</TableHead>
                <TableHead className="min-w-[100px]">手机</TableHead>
                <TableHead className="min-w-[120px]">地址</TableHead>
                <TableHead className="min-w-[80px]">负责人</TableHead>
                <TableHead className="min-w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-blue-600 cursor-pointer">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getLevelVariant(item.level)}
                        className={cn(
                          item.level === '优质客户' && 'bg-green-100 text-green-700 border-0',
                          item.level === 'VIP客户' && 'bg-purple-100 text-purple-700 border-0'
                        )}
                      >
                        {item.level || '普通'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{item.source || '-'}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(item.created_at)}</TableCell>
                    <TableCell>
                      {item.qualifications ? (
                        <div className="flex flex-wrap gap-1">
                          {item.qualifications.split(',').slice(0, 2).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs h-5">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(item.status)}
                        className={cn(
                          item.status === '已成交' && 'bg-green-100 text-green-700 border-0',
                          item.status === '跟进中' && 'bg-blue-100 text-blue-700 border-0',
                          item.status === '未成交' && 'bg-gray-100 text-gray-600 border-0'
                        )}
                      >
                        {item.status || '未成交'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{item.phone || '-'}</TableCell>
                    <TableCell className="text-slate-600 max-w-32 truncate">
                      {item.address || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">{item.owner || '-'}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                        onClick={() => handleDeleteCustomer(item.id)}
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
        <span className="text-sm text-slate-600">共 {filteredCustomers.length} 条数据</span>
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
