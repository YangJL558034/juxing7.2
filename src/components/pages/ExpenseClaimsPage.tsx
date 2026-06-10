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
import { Plus, Search, Eye, Trash2, Download, Check, X, Circle } from 'lucide-react';
import { chinaToday, formatChinaDateTime } from '@/lib/china-time';

interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: string;
  department?: string;
}

interface ExpenseClaim {
  id: number;
  claim_no: string;
  title: string;
  applicant_id: number;
  applicant_name: string;
  department: string;
  expense_type: string;
  expense_date: string;
  items: string;
  total_amount: number;
  description: string;
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

interface ExpenseItem {
  name: string;
  amount: number;
  remark: string;
}

export default function ExpenseClaimsPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    expense_type: '差旅费',
    expense_date: chinaToday(),
    description: '',
    items: [{ name: '', amount: 0, remark: '' }] as ExpenseItem[],
    approver_id: '',
  });
  
  const [users, setUsers] = useState<User[]>([]);

  const fetchClaims = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/expense-claims', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.claims) {
        setClaims(data.claims);
      }
    } catch (error) {
      console.error('获取费用报销单列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchClaims();
    fetchUsers();
  }, [fetchClaims]);

  // 计算总金额
  const totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0);

  // 添加明细项
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', amount: 0, remark: '' }]
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
  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  // 上传文件
  const uploadFile = async (file: File): Promise<{ key: string; name: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/expense-claims/upload', {
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

  // 提交报销单
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
      const response = await fetch('/api/expense-claims', {
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
        alert('费用报销单提交成功！');
        setShowCreateDialog(false);
        resetForm();
        fetchClaims();
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交费用报销单失败:', error);
      alert('提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除报销单
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个费用报销单吗？')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/expense-claims/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        fetchClaims();
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
      department: '',
      expense_type: '差旅费',
      expense_date: chinaToday(),
      description: '',
      items: [{ name: '', amount: 0, remark: '' }],
      approver_id: '',
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

  // 过滤列表
  const filteredClaims = claims.filter(claim => {
    const matchSearch = claim.title.includes(searchTerm) || claim.claim_no.includes(searchTerm) || claim.applicant_name.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">费用报销管理</h1>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          新增报销单
        </Button>
      </div>

      <Card>
          <CardHeader>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索报销单..."
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
                  <TableHead>费用类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>当前审批人</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-mono">{claim.claim_no}</TableCell>
                    <TableCell>{claim.title}</TableCell>
                    <TableCell>{claim.applicant_name}</TableCell>
                    <TableCell>{claim.expense_type}</TableCell>
                    <TableCell className="text-right">¥{(claim.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusStyle(claim.status)}>{claim.status}</Badge>
                    </TableCell>
                    <TableCell>{claim.current_approver_name || '-'}</TableCell>
                    <TableCell>{formatChinaDateTime(claim.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedClaim(claim); setShowDetailDialog(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {claim.status === '待审批' && (
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(claim.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClaims.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      {/* 新增报销单对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增费用报销单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>报销标题 *</Label>
                <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="请输入报销标题" />
              </div>
              <div>
                <Label>审批人 *</Label>
                <Select value={formData.approver_id} onValueChange={(value) => setFormData(prev => ({ ...prev, approver_id: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择审批人" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.username}) {user.email ? `- ${user.email}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>费用类型 *</Label>
                <Select value={formData.expense_type} onValueChange={(value) => setFormData(prev => ({ ...prev, expense_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="差旅费">差旅费</SelectItem>
                    <SelectItem value="交通费">交通费</SelectItem>
                    <SelectItem value="餐饮费">餐饮费</SelectItem>
                    <SelectItem value="办公用品">办公用品</SelectItem>
                    <SelectItem value="通讯费">通讯费</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>费用日期</Label>
                <Input type="date" value={formData.expense_date} onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>附件证明（发票等）</Label>
              <Input type="file" accept=".pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>费用明细</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" />添加明细
                </Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="min-w-[120px]">费用项目 *</TableHead>
                      <TableHead className="min-w-[80px]">金额</TableHead>
                      <TableHead className="min-w-[100px]">备注</TableHead>
                      <TableHead className="w-16">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="费用项目" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.amount} onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell>
                          <Input value={item.remark} onChange={(e) => updateItem(index, 'remark', e.target.value)} placeholder="备注" />
                        </TableCell>
                        <TableCell>
                          {formData.items.length > 1 && (
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeItem(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right mt-2 text-lg font-bold">
                合计金额：¥{totalAmount.toFixed(2)}
              </div>
            </div>

            <div>
              <Label>报销说明</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="请输入报销说明" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '提交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>费用报销单详情</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">单据编号</Label>
                  <p className="font-mono">{selectedClaim.claim_no}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <p><Badge className={getStatusStyle(selectedClaim.status)}>{selectedClaim.status}</Badge></p>
                </div>
                <div>
                  <Label className="text-muted-foreground">标题</Label>
                  <p className="font-medium">{selectedClaim.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">费用类型</Label>
                  <p>{selectedClaim.expense_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">申请人</Label>
                  <p>{selectedClaim.applicant_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">部门</Label>
                  <p>{selectedClaim.department || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">费用日期</Label>
                  <p>{selectedClaim.expense_date || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">申请时间</Label>
                  <p>{formatChinaDateTime(selectedClaim.created_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">当前审批人</Label>
                  <p>{selectedClaim.current_approver_name || '-'}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">费用明细</Label>
                <div className="border rounded-lg mt-2 overflow-x-auto">
                  <div className="min-w-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="w-40">费用项目</TableHead>
                          <TableHead className="w-24 text-right">金额</TableHead>
                          <TableHead>备注</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(typeof selectedClaim.items === 'string' ? JSON.parse(selectedClaim.items) : selectedClaim.items).map((item: ExpenseItem, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="truncate" title={item.name}>{item.name}</TableCell>
                            <TableCell className="text-right">¥{item.amount.toFixed(2)}</TableCell>
                            <TableCell className="truncate" title={item.remark || '-'}>{item.remark || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="text-right mt-2 text-lg font-bold">
                  合计金额：¥{(selectedClaim.total_amount || 0).toFixed(2)}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">报销说明</Label>
                <p className="whitespace-pre-wrap">{selectedClaim.description || '-'}</p>
              </div>

              {selectedClaim.proof_file && (
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
                        if (!selectedClaim.proof_file) {
                          alert('没有可下载的文件');
                          return;
                        }
                        const token = localStorage.getItem('token');
                        const url = `/api/expense-claims/download?key=${encodeURIComponent(selectedClaim.proof_file)}`;
                        const response = await fetch(url, {
                          headers: {
                            'Authorization': `Bearer ${token}`,
                          },
                        });
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(`下载失败: ${response.status} - ${errorData.error || '未知错误'}`);
                        }
                        const blob = await response.blob();
                        const downloadUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = selectedClaim.proof_file_name || 'attachment.pdf';
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
                    {selectedClaim.proof_file_name || '下载附件'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-2">点击下载查看证明文件（存证）</p>
                </div>
              )}

              {/* 审批记录 */}
              {selectedClaim.approvals && selectedClaim.approvals.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">审批记录</Label>
                  <div className="border rounded-lg mt-2 p-4 space-y-3">
                    {selectedClaim.approvals.map((approval, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${approval.action === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {approval.action === 'approved' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{approval.approver_name}</span>
                            <span className="text-sm text-muted-foreground">{formatChinaDateTime(approval.created_at)}</span>
                          </div>
                          <p className="text-sm">
                            <Badge variant={approval.action === 'approved' ? 'default' : 'destructive'} className="mr-2">
                              {approval.action === 'approved' ? '通过' : '驳回'}
                            </Badge>
                            {approval.comment}
                          </p>
                        </div>
                      </div>
                    ))}
                    {selectedClaim.status === '一审已通过待二审' && (
                      <div className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-purple-600">
                          <Circle className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-purple-600">财务终审</span>
                          </div>
                          <p className="text-sm text-muted-foreground">等待财务审核</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
