'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { formatChinaDate } from '@/lib/china-time';

const todoCategories = [
  '今日需联系线索',
  '今日需联系商机',
  '分配给我的线索',
  '分配给我的客户',
  '待进入公海的客户',
  '待审核合同',
  '待审核回款',
  '待回款提醒',
  '即将到期的合同',
  '待回访合同',
  '待审核发票',
];

interface Todo {
  id: number;
  category: string;
  name: string;
  industry: string;
  level: string;
  source: string;
  phone: string;
  address: string;
  remark: string;
  last_follow: string;
  creator: string;
  department: string;
  owner: string;
  processed: number;
  created_at: string;
  updated_at: string;
}

export function TodoPage() {
  const [selectedCategory, setSelectedCategory] = useState('今日需联系线索');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodos();
  }, [selectedCategory]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/todos?category=${encodeURIComponent(selectedCategory)}`);
      const data = await res.json();
      if (data.success) {
        setTodos(data.data);
      }
    } catch (error) {
      console.error('获取待办事项失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkProcessed = async (id: number) => {
    try {
      const res = await fetch('/api/todos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTodos();
      }
    } catch (error) {
      console.error('标记失败:', error);
    }
  };

  const handleMarkAllProcessed = async () => {
    for (const todo of todos) {
      if (!todo.processed) {
        await handleMarkProcessed(todo.id);
      }
    }
  };

  const getLevelVariant = (level: string) => {
    switch (level) {
      case '优质客户':
        return 'default';
      case '无效客户':
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
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left Sidebar - 响应式 */}
      <div className="w-56 bg-white border-r border-slate-200 overflow-y-auto hidden md:block">
        <div className="p-4">
          <h2 className="text-sm font-medium text-slate-500 mb-3">待办分类</h2>
          <div className="space-y-1">
            {todoCategories.map((category) => (
              <Button
                key={category}
                variant="ghost"
                className={cn(
                  'w-full justify-start text-sm h-10',
                  selectedCategory === category
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
                onClick={() => setSelectedCategory(category)}
              >
                <span className="truncate">{category}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Category Select */}
      <div className="md:hidden fixed top-14 left-0 right-0 bg-white border-b border-slate-200 p-3 z-10">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent>
            {todoCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Select defaultValue="today">
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今日需联系</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="mine">
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">我的</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-9 text-sm">
                高级筛选
              </Button>
            </div>
            <Button 
              className="bg-green-600 hover:bg-green-700 h-9 text-sm"
              onClick={handleMarkAllProcessed}
            >
              全部标记已处理
            </Button>
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="min-w-[100px]">线索名称</TableHead>
                    <TableHead className="min-w-[80px]">客户行业</TableHead>
                    <TableHead className="min-w-[80px]">客户级别</TableHead>
                    <TableHead className="min-w-[80px]">线索来源</TableHead>
                    <TableHead className="min-w-[100px]">手机</TableHead>
                    <TableHead className="min-w-[120px]">地址</TableHead>
                    <TableHead className="min-w-[100px]">备注</TableHead>
                    <TableHead className="min-w-[120px]">最后跟进记录</TableHead>
                    <TableHead className="min-w-[80px]">创建人</TableHead>
                    <TableHead className="min-w-[80px]">所属部门</TableHead>
                    <TableHead className="min-w-[100px]">创建时间</TableHead>
                    <TableHead className="min-w-[80px]">负责人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : todos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    todos.filter(t => !t.processed).map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-blue-600 cursor-pointer">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-slate-600">{item.industry || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getLevelVariant(item.level)}
                            className={cn(
                              item.level === '优质客户' && 'bg-green-100 text-green-700 border-0'
                            )}
                          >
                            {item.level || '普通'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">{item.source || '-'}</TableCell>
                        <TableCell className="text-slate-600">{item.phone || '-'}</TableCell>
                        <TableCell className="text-slate-600 max-w-32 truncate">
                          {item.address || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-32 truncate">
                          {item.remark || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-40 truncate">
                          {item.last_follow || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600">{item.creator || '-'}</TableCell>
                        <TableCell className="text-slate-600">{item.department || '-'}</TableCell>
                        <TableCell className="text-slate-600">{formatDate(item.created_at)}</TableCell>
                        <TableCell className="text-slate-600">{item.owner || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
            <span className="text-sm text-slate-600">共 {todos.filter(t => !t.processed).length} 条数据</span>
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
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 mx-1 bg-blue-50 text-blue-600 border-blue-200">
                  1
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-2">
                  &gt;
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
