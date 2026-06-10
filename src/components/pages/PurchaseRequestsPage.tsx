'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Eye, Edit, Trash2, Check, X, FileText, Upload, Download, User, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatChinaDateTime } from '@/lib/china-time';

interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: string;
}

interface PurchaseRequest {
  id: number;
  request_no: string;
  title: string;
  applicant_id: number;
  applicant_name: string;
  department: string;
  items: string;
  total_amount: number;
  reason: string;
  urgency: string;
  status: string;
  current_approver_id: number | null;
  current_approver_name: string | null;
  proof_file: string | null;
  proof_file_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  approvals?: ApprovalRecord[];
}

interface ApprovalRecord {
  id: number;
  approver_id: number;
  approver_name: string;
  action: string;
  comment: string | null;
  created_at: string;
  approval_order: number;
}

interface PurchaseItem {
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  remark: string;
}

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    approver_id: '',
    reason: '',
    urgency: '普通',
    items: [{ name: '', specification: '', quantity: 1, unit: '件', unit_price: 0, amount: 0, remark: '' }] as PurchaseItem[],
  });

  const fetchRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/purchase-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('获取请购单列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, [fetchRequests]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  // 计算总金额
  const totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0);

  // 添加明细项
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', specification: '', quantity: 1, unit: '件', unit_price: 0, amount: 0, remark: '' }]
    }));
  };

  // 删除明细项
  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // 更新明细项
  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      // 自动计算金额
      if (field === 'quantity' || field === 'unit_price') {
        items[index].amount = items[index].quantity * items[index].unit_price;
      }
      return { ...prev, items };
    });
  };

  // 上传文件
  const uploadFile = async (file: File): Promise<{ key: string; name: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/purchase-requests/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (data.key) {
        return { key: data.key, name: file.name };
      }
      return null;
    } catch (error) {
      console.error('上传文件失败:', error);
      return null;
    }
  };

  // 提交请购单
  const handleSubmit = async () => {
    if (!formData.title || !formData.approver_id || formData.items.some(item => !item.name)) {
      alert('请填写完整信息，包括审批人');
      return;
    }

    setIsSubmitting(true);
    try {
      let proofFileData = null;
      if (proofFile) {
        proofFileData = await uploadFile(proofFile);
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          total_amount: totalAmount,
          proof_file: proofFileData?.key,
          proof_file_name: proofFileData?.name,
          approver_id: parseInt(formData.approver_id)
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('请购单提交成功！');
        setShowCreateDialog(false);
        resetForm();
        fetchRequests();
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交请购单失败:', error);
      alert('提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除请购单
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个请购单吗？')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/purchase-requests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        fetchRequests();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      approver_id: '',
      reason: '',
      urgency: '普通',
      items: [{ name: '', specification: '', quantity: 1, unit: '件', unit_price: 0, amount: 0, remark: '' }],
    });
    setProofFile(null);
  };

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case '待审批': return 'bg-yellow-100 text-yellow-800';
      case '一审已通过待二审': return 'bg-purple-100 text-purple-800';
      case '已通过': return 'bg-green-100 text-green-800';
      case '已驳回': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 获取紧急程度样式
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case '紧急': return 'bg-red-100 text-red-800';
      case '加急': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // 过滤列表
  const filteredRequests = requests.filter(req => {
    const matchSearch = req.title.includes(searchTerm) || req.request_no.includes(searchTerm) || req.applicant_name.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">请购单管理</h1>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          新增请购单
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">全部请购单</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索请购单..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="状态筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="待审批">待审批</SelectItem>
                    <SelectItem value="已通过">已通过</SelectItem>
                    <SelectItem value="已驳回">已驳回</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>单据编号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>申请人</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>紧急程度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>当前审批人</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono">{req.request_no}</TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.applicant_name}</TableCell>
                      <TableCell>{req.department || '-'}</TableCell>
                      <TableCell className="text-right">¥{(req.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getUrgencyStyle(req.urgency)}>{req.urgency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusStyle(req.status)}>{req.status}</Badge>
                      </TableCell>
                      <TableCell>{req.current_approver_name || '-'}</TableCell>
                      <TableCell>{formatChinaDateTime(req.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedRequest(req); setShowDetailDialog(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {req.status === '待审批' && (
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(req.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增请购单对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              新增请购单
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* 基本信息 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                <h3 className="font-semibold text-slate-700">基本信息</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">请购标题 <span className="text-red-500">*</span></Label>
                  <Input 
                    value={formData.title} 
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} 
                    placeholder="请输入请购标题"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">审批人 <span className="text-red-500">*</span></Label>
                  <Select value={formData.approver_id} onValueChange={(value) => setFormData(prev => ({ ...prev, approver_id: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="请选择审批人" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{user.name}</span>
                            <span className="text-xs text-muted-foreground">({user.username})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">紧急程度</Label>
                  <Select value={formData.urgency} onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="普通">普通</SelectItem>
                      <SelectItem value="加急">加急</SelectItem>
                      <SelectItem value="紧急">紧急</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">附件证明</Label>
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)} 
                      className="text-sm cursor-pointer"
                    />
                    <p className="text-xs text-slate-400 mt-1">支持 PDF 格式文件（作为审批证明）</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 采购明细 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-green-500 rounded-full"></span>
                  <h3 className="font-semibold text-slate-700">采购明细</h3>
                </div>
                <Button size="sm" variant="outline" onClick={addItem} className="bg-white text-sm gap-1">
                  <Plus className="w-3.5 h-3.5" />添加物品
                </Button>
              </div>
              
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-slate-500">物品 {index + 1}</span>
                      {formData.items.length > 1 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">物品名称 <span className="text-red-500">*</span></Label>
                        <Input 
                          value={item.name} 
                          onChange={(e) => updateItem(index, 'name', e.target.value)} 
                          placeholder="请输入物品名称"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">规格型号</Label>
                        <Input 
                          value={item.specification} 
                          onChange={(e) => updateItem(index, 'specification', e.target.value)} 
                          placeholder="规格/型号"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">数量</Label>
                        <Input 
                          type="number" 
                          min="1"
                          value={item.quantity} 
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">单位</Label>
                        <Input 
                          value={item.unit} 
                          onChange={(e) => updateItem(index, 'unit', e.target.value)} 
                          placeholder="件"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">单价 (¥)</Label>
                        <Input 
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price} 
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} 
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">金额</Label>
                        <div className="text-sm font-semibold text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                          ¥{item.amount.toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-slate-500">备注</Label>
                        <Input 
                          value={item.remark} 
                          onChange={(e) => updateItem(index, 'remark', e.target.value)} 
                          placeholder="备注信息（可选）"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-500">共 {formData.items.length} 项物品</span>
                <div className="text-right">
                  <span className="text-sm text-slate-500">合计金额：</span>
                  <span className="text-xl font-bold text-blue-600 ml-1">¥{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 请购原因 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                <h3 className="font-semibold text-slate-700">请购原因</h3>
              </div>
              <Textarea 
                value={formData.reason} 
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} 
                placeholder="请详细描述请购原因和用途..."
                rows={3}
                className="text-sm bg-white"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateDialog(false)} 
              className="flex-1"
            >
              取消
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting} 
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              {isSubmitting ? (
                <>提交中...</>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  提交请购单
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-slate-800">请购单详情</DialogTitle>
            <div className="flex items-center gap-3">
              <Badge className={`text-xs ${getStatusStyle(selectedRequest?.status || '')}`}>
                {selectedRequest?.status || '-'}
              </Badge>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {selectedRequest && (
              <>
                {/* 单据编号和标题 */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">单据编号</span>
                    <span className="text-xs text-muted-foreground">标题</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-slate-800">{selectedRequest.request_no}</span>
                    <span className="text-sm font-medium text-slate-800">{selectedRequest.title}</span>
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">申请人</span>
                    <span className="text-sm font-medium text-slate-800">{selectedRequest.applicant_name}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">部门</span>
                    <span className="text-sm font-medium text-slate-800">{selectedRequest.department || '-'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">申请时间</span>
                    <span className="text-sm text-slate-700">{formatChinaDateTime(selectedRequest.created_at)}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">紧急程度</span>
                    <Badge variant="secondary" className={`text-xs ${getUrgencyStyle(selectedRequest.urgency)}`}>
                      {selectedRequest.urgency}
                    </Badge>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">当前审批人</span>
                    <span className="text-sm text-slate-700">{selectedRequest.current_approver_name || '-'}</span>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground block mb-1">合计金额</span>
                    <span className="text-lg font-bold text-blue-600">¥{(selectedRequest.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* 采购明细 */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-4 bg-green-500 rounded-full"></span>
                    <span className="font-semibold text-slate-700">采购明细</span>
                  </div>
                  <div className="space-y-2">
                    {(typeof selectedRequest.items === 'string' ? JSON.parse(selectedRequest.items) : selectedRequest.items).map((item: PurchaseItem, index: number) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-slate-100">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <span className="text-sm font-semibold text-blue-600">¥{item.amount.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                          <span>{item.specification || '-'}</span>
                          <span className="text-right">{item.quantity} {item.unit}</span>
                          <span className="text-right">¥{item.unit_price.toFixed(2)}/件</span>
                          {item.remark && <span className="text-slate-400">备注: {item.remark}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">共 {(typeof selectedRequest.items === 'string' ? JSON.parse(selectedRequest.items) : selectedRequest.items).length} 项</span>
                    <span className="text-lg font-bold text-blue-600">合计：¥{(selectedRequest.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* 请购原因 */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                    <span className="font-semibold text-slate-700">请购原因</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed bg-white rounded-lg p-3">
                    {selectedRequest.reason || '-'}
                  </p>
                </div>

                {/* 附件证明 */}
                {selectedRequest.proof_file && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                      <span className="font-semibold text-slate-700">附件证明</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={async () => {
                        try {
                          if (!selectedRequest.proof_file) {
                            alert('没有可下载的文件');
                            return;
                          }
                          const token = localStorage.getItem('token');
                          console.log('Token exists:', !!token);
                          console.log('File key:', selectedRequest.proof_file);
                          const url = `/api/purchase-requests/download?key=${encodeURIComponent(selectedRequest.proof_file)}`;
                          console.log('Download URL:', url);
                          const response = await fetch(url, {
                            headers: {
                              'Authorization': `Bearer ${token}`,
                            },
                          });
                          console.log('Response status:', response.status);
                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`下载失败: ${response.status} - ${errorData.error || errorData.message || '未知错误'}`);
                          }
                          const blob = await response.blob();
                          console.log('Blob size:', blob.size);
                          const downloadUrl = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = downloadUrl;
                          link.download = selectedRequest.proof_file_name || 'attachment.pdf';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(downloadUrl);
                        } catch (error) {
                          console.error('下载失败:', error);
                          alert(error instanceof Error ? error.message : '下载失败，请检查网络连接');
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      {selectedRequest.proof_file_name || '下载附件'}
                    </Button>
                    <p className="text-xs text-slate-400 mt-2">点击下载查看证明文件（存证）</p>
                  </div>
                )}

                {/* 审批记录 */}
                {(selectedRequest.approvals && selectedRequest.approvals.length > 0) && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                      <span className="font-semibold text-slate-700">审批记录</span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
                      {selectedRequest.approvals.map((approval, index) => (
                        <div key={index} className="relative flex gap-4 pl-10 pb-4 last:pb-0">
                          <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${approval.action === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {approval.action === 'approved' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 bg-white rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-slate-800 text-sm">{approval.approver_name}</span>
                              <span className="text-xs text-muted-foreground">{formatChinaDateTime(approval.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={approval.action === 'approved' ? 'default' : 'destructive'} className="text-xs">
                                {approval.action === 'approved' ? '通过' : '驳回'}
                              </Badge>
                              {approval.comment && (
                                <span className="text-xs text-slate-500">备注：{approval.comment}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedRequest.status === '一审已通过待二审' && (
                        <div className="relative flex gap-4 pl-10 pt-4">
                          <div className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-purple-600">
                            <Circle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 bg-purple-50 rounded-lg p-3 border border-purple-100">
                            <span className="font-medium text-purple-700 text-sm">财务终审</span>
                            <p className="text-xs text-muted-foreground mt-1">等待财务审核...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter className="border-t border-slate-100 px-6 py-3">
            <Button variant="outline" className="w-full" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
