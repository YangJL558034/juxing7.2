'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Landmark,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  Eye,
  Calendar,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface ApprovalRecord {
  id: number;
  approver_id: number;
  approver_name: string;
  action: string;
  comment: string | null;
  approval_order: number;
  created_at: string;
}

interface FinanceItem {
  id: number;
  type: 'purchase' | 'expense';
  typeName: string;
  title: string;
  applicantName: string;
  applicantId: number;
  department: string;
  amount: number;
  status: string;
  createTime: string;
  docNo: string;
  items?: Array<{ name: string; quantity: number; price: number; unit_price?: number }>;
  approvals: ApprovalRecord[];
  proof_file?: string | null;
  proof_file_name?: string | null;
}

export default function FinanceReviewPage() {
  const [selectedItem, setSelectedItem] = useState<FinanceItem | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'record'>('record');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 格式化年月分组
  const formatYearMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  // 模糊搜索匹配函数
  const matchesSearch = (item: FinanceItem, query: string) => {
    if (!query.trim()) return true;
    
    const searchLower = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(searchLower) ||
      item.docNo.toLowerCase().includes(searchLower) ||
      item.applicantName.toLowerCase().includes(searchLower) ||
      (item.department && item.department.toLowerCase().includes(searchLower))
    );
  };

  // 按年月分组记录（包含搜索过滤）
  const groupedRecords = useMemo(() => {
    const recordItems = items.filter(item => 
      item.status === '已通过' || item.status === '已驳回'
    );
    
    // 应用搜索过滤
    const filteredItems = recordItems.filter(item => 
      matchesSearch(item, searchQuery)
    );
    
    const groups: Record<string, FinanceItem[]> = {};
    
    filteredItems.forEach(item => {
      const monthKey = formatYearMonth(item.createTime);
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(item);
    });

    // 按时间倒序排序分组
    const sortedMonths = Object.keys(groups).sort((a, b) => {
      // 提取年月进行比较
      const getDate = (str: string) => {
        const match = str.match(/(\d+)年(\d+)月/);
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1);
        }
        return new Date();
      };
      return getDate(b).getTime() - getDate(a).getTime();
    });

    return { groups, sortedMonths };
  }, [items, searchQuery]);

  // 监听搜索变化，搜索时自动展开包含结果的月份
  useEffect(() => {
    if (searchQuery.trim()) {
      // 搜索时自动展开所有包含结果的月份
      const monthsToExpand = new Set<string>();
      items.forEach(item => {
        if (matchesSearch(item, searchQuery)) {
          monthsToExpand.add(formatYearMonth(item.createTime));
        }
      });
      setExpandedMonths(monthsToExpand);
    }
  }, [searchQuery, items]);

  // 切换折叠状态
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const fetchFinanceItems = async () => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const [purchaseRes, expenseRes] = await Promise.all([
        fetch('/api/purchase-requests?approval=true', { headers }),
        fetch('/api/expense-claims?approval=true', { headers }),
      ]);
      
      const purchaseData = await purchaseRes.json();
      const expenseData = await expenseRes.json();
      
      const purchaseItems: FinanceItem[] = (purchaseData.requests || []).map((item: any) => ({
        id: Number(item.id),
        type: 'purchase',
        typeName: '请购单',
        title: item.title,
        applicantName: item.applicant_name,
        applicantId: Number(item.applicant_id),
        department: item.department || '',
        amount: Number(item.total_amount) || 0,
        status: item.status || '待审批',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString() : '',
        docNo: item.request_no,
        items: item.items ? JSON.parse(item.items) : undefined,
        approvals: item.approvals || [],
        proof_file: item.proof_file || null,
        proof_file_name: item.proof_file_name || null,
      }));
      
      const expenseItems: FinanceItem[] = (expenseData.claims || []).map((item: any) => ({
        id: Number(item.id),
        type: 'expense',
        typeName: '报销单',
        title: item.title,
        applicantName: item.applicant_name,
        applicantId: Number(item.applicant_id),
        department: item.department || '',
        amount: Number(item.total_amount) || 0,
        status: item.status || '待审批',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString() : '',
        docNo: item.claim_no,
        items: item.items ? JSON.parse(item.items) : undefined,
        approvals: item.approvals || [],
        proof_file: item.proof_file || null,
        proof_file_name: item.proof_file_name || null,
      }));
      
      const allItems = [...purchaseItems, ...expenseItems];
      const financeItems = allItems.filter(item => {
        if (item.status === '一审已通过待二审') {
          return true;
        }
        if (item.status === '已通过' || item.status === '已驳回') {
          const hasFinanceApproval = item.approvals.some(approval => approval.approval_order >= 2);
          return hasFinanceApproval;
        }
        return false;
      });
      setItems(financeItems);
    } catch (error) {
      console.error('获取财务终审单据失败:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 自动刷新 - 每20秒更新一次财务数据
  const { refreshNow } = useAutoRefresh({
    enabled: true,
    interval: 20000,
    onRefresh: fetchFinanceItems,
  });

  useEffect(() => {
    fetchFinanceItems();
  }, []);

  const statistics = {
    pending: items.filter(item => item.status === '一审已通过待二审').length,
    todayReviewed: items.filter(item => item.status === '已通过' || item.status === '已驳回').length,
    totalAmount: items.filter(item => item.status === '一审已通过待二审').reduce((sum, item) => sum + item.amount, 0),
    passedRate: items.length > 0 ? Math.round((items.filter(item => item.status === '已通过').length / items.length) * 100) : 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '一审已通过待二审':
      case '财务终审':
      case '待财务审核':
        return 'bg-purple-100 text-purple-700';
      case '已通过':
        return 'bg-green-100 text-green-700';
      case '已驳回':
        return 'bg-red-100 text-red-700';
      case '待审批':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getActionText = (action: string) => {
    return action === 'approved' ? '同意' : action === 'rejected' ? '驳回' : action;
  };

  const handleViewDetail = (item: FinanceItem) => {
    setSelectedItem(item);
    setApprovalComment('');
    setShowDetailDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }
      
      const url = selectedItem.type === 'purchase' 
        ? `/api/purchase-requests/${selectedItem.id}/approve`
        : `/api/expense-claims/${selectedItem.id}/approve`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'approve', comment: approvalComment }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setShowDetailDialog(false);
        setApprovalComment('');
        fetchFinanceItems();
      } else {
        alert(data.error || '审批失败');
      }
    } catch (error) {
      console.error('财务审核失败:', error);
      alert('财务审核失败，请稍后重试');
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    
    if (!approvalComment.trim()) {
      alert('请填写驳回原因');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }
      
      const url = selectedItem.type === 'purchase' 
        ? `/api/purchase-requests/${selectedItem.id}/approve`
        : `/api/expense-claims/${selectedItem.id}/approve`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'reject', comment: approvalComment }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setShowDetailDialog(false);
        setApprovalComment('');
        fetchFinanceItems();
      } else {
        alert(data.error || '驳回失败');
      }
    } catch (error) {
      console.error('驳回失败:', error);
      alert('驳回失败，请稍后重试');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">财务终审</h1>
          <p className="text-slate-500 mt-1">处理待财务审核的单据</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchFinanceItems} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button className="bg-purple-500 hover:bg-purple-600">
            <Landmark className="w-4 h-4 mr-2" />
            财务报表
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-600">{statistics.pending}</p>
              <p className="text-sm text-slate-500">待审核</p>
            </div>
            <Landmark className="w-10 h-10 text-purple-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">{statistics.todayReviewed}</p>
              <p className="text-sm text-slate-500">今日审核</p>
            </div>
            <Calendar className="w-10 h-10 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">¥{statistics.totalAmount.toLocaleString()}</p>
              <p className="text-sm text-slate-500">待审金额</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-600">{statistics.passedRate}%</p>
              <p className="text-sm text-slate-500">通过率</p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-purple-500" />
                  {activeTab === 'pending' ? '待财务审核单据' : '审核记录'}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === 'pending' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('pending')}
                  >
                    待审核
                  </Button>
                  <Button
                    variant={activeTab === 'record' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('record')}
                  >
                    记录
                  </Button>
                  <Button variant="outline" size="sm" onClick={refreshNow} disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
              <div className="relative">
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="搜索标题、单号、申请人、部门..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              if (activeTab === 'pending') {
                // 待审核标签页：保持原有显示并应用搜索
                const pendingItems = items.filter(item => 
                  item.status === '一审已通过待二审' && 
                  matchesSearch(item, searchQuery)
                );
                
                if (pendingItems.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileText className="w-12 h-12 mb-4" />
                      <p>暂无待财务审核的单据</p>
                    </div>
                  );
                }
                
                return pendingItems.map(item => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          item.type === 'purchase' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {item.type === 'purchase' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <DollarSign className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            <Badge variant="outline">{item.typeName}</Badge>
                            <Badge variant="secondary" className="text-xs">{item.docNo}</Badge>
                          </div>
                          <p className="text-sm text-slate-500">
                            申请人: {item.applicantName} | 部门: {item.department} | {item.createTime}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-slate-500">已审批: <span className="text-slate-700">{item.approvals.length} 级</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">¥{item.amount.toLocaleString()}</p>
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetail(item)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            详情
                          </Button>
                          <>
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600"
                              onClick={() => { setSelectedItem(item); handleApprove(); }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetail(item)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              驳回
                            </Button>
                          </>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              } else {
                // 记录标签页：按年月折叠显示
                if (groupedRecords.sortedMonths.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileText className="w-12 h-12 mb-4" />
                      <p>暂无审核记录</p>
                    </div>
                  );
                }
                
                return groupedRecords.sortedMonths.map(monthKey => {
                  const monthItems = groupedRecords.groups[monthKey];
                  const isExpanded = expandedMonths.has(monthKey);
                  
                  return (
                    <div key={monthKey} className="border rounded-lg overflow-hidden">
                      {/* 折叠标题栏 */}
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-slate-700">
                            <svg 
                              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <span className="font-semibold text-slate-800">{monthKey}</span>
                          <Badge variant="outline" className="text-xs">{monthItems.length} 条记录</Badge>
                        </div>
                        <div className="text-sm text-slate-500">
                          点击 {isExpanded ? '收起' : '展开'}
                        </div>
                      </button>
                      
                      {/* 展开内容 */}
                      {isExpanded && (
                        <div className="border-t">
                          {monthItems.map(item => (
                            <div
                              key={item.id}
                              className="p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    item.type === 'purchase' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                  }`}>
                                    {item.type === 'purchase' ? (
                                      <FileText className="w-5 h-5" />
                                    ) : (
                                      <DollarSign className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{item.title}</span>
                                      <Badge variant="outline">{item.typeName}</Badge>
                                      <Badge variant="secondary" className="text-xs">{item.docNo}</Badge>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      申请人: {item.applicantName} | 部门: {item.department} | {item.createTime}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                      <span className="text-slate-500">已审批: <span className="text-slate-700">{item.approvals.length} 级</span></span>
                                    </div>
                                    {item.approvals.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap mt-2">
                                        {(() => {
                                          const lastApproval = item.approvals[item.approvals.length - 1];
                                          return (
                                            <Badge className={lastApproval.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                              {lastApproval.approver_name}({getActionText(lastApproval.action)})
                                            </Badge>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-slate-800">¥{item.amount.toLocaleString()}</p>
                                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewDetail(item)}
                                    >
                                      <Eye className="w-4 h-4 mr-1" />
                                      详情
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              {item.approvals.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm text-slate-500 mb-2">终审记录:</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(() => {
                                      const lastApproval = item.approvals[item.approvals.length - 1];
                                      return (
                                        <Badge className={lastApproval.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                          {lastApproval.approver_name}({getActionText(lastApproval.action)})
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              }
            })()}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.type === 'purchase' ? (
                <FileText className="w-5 h-5 text-orange-500" />
              ) : (
                <DollarSign className="w-5 h-5 text-green-500" />
              )}
              {selectedItem?.title} - 财务审核详情
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">单据类型</p>
                  <p className="font-medium">{selectedItem.typeName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">单据编号</p>
                  <p className="font-medium font-mono text-sm">{selectedItem.docNo}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">当前状态</p>
                  <Badge className={getStatusColor(selectedItem.status)}>{selectedItem.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">申请人</p>
                  <p className="font-medium">{selectedItem.applicantName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">所属部门</p>
                  <p className="font-medium">{selectedItem.department}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">申请时间</p>
                  <p className="font-medium">{selectedItem.createTime}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">金额</p>
                <p className="text-2xl font-bold text-purple-600">¥{selectedItem.amount.toLocaleString()}</p>
              </div>

              {selectedItem.items && selectedItem.items.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">物品明细</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">物品名称</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">数量</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">单价</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">小计</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItem.items.map((item, index) => {
                          const price = item.price || item.unit_price || 0;
                          const quantity = item.quantity || 0;
                          return (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2 text-sm">{item.name}</td>
                              <td className="px-4 py-2 text-sm text-right">{quantity}</td>
                              <td className="px-4 py-2 text-sm text-right">¥{price.toLocaleString()}</td>
                              <td className="px-4 py-2 text-sm text-right">¥{(quantity * price).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedItem.proof_file && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">附件证明</p>
                  <Button 
                    variant="default" 
                    size="sm"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        if (!selectedItem.proof_file) {
                          alert('没有可下载的文件');
                          return;
                        }
                        const token = localStorage.getItem('token');
                        const apiPath = selectedItem.type === 'purchase' ? 'purchase-requests' : 'expense-claims';
                        const url = `/api/${apiPath}/download?key=${encodeURIComponent(selectedItem.proof_file)}`;
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
                        link.download = selectedItem.proof_file_name || 'attachment.pdf';
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
                    <FileText className="w-4 h-4" />
                    {selectedItem.proof_file_name || '附件下载'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-2">点击下载查看证明文件（存证）</p>
                </div>
              )}

              <div>
                <p className="text-sm text-slate-500 mb-3">审批流程记录</p>
                <div className="space-y-3">
                  {selectedItem.approvals.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${step.action === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {index < selectedItem.approvals.length - 1 && (
                          <div className="w-px h-8 bg-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{step.approver_name}</span>
                          <Badge className={step.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {getActionText(step.action)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{step.created_at ? new Date(step.created_at).toLocaleString() : ''}</p>
                        {step.comment && (
                          <p className="text-sm text-slate-600 mt-1">审批意见: {step.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedItem.status === '一审已通过待二审' && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-purple-600">财务终审</span>
                        <p className="text-sm text-slate-500">等待财务审核</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {selectedItem.status === '一审已通过待二审' && (
                  <>
                    <div>
                      <p className="text-sm text-slate-500 mb-2">审批意见（驳回时必填）</p>
                      <Input
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        placeholder="请输入审批意见或驳回原因..."
                        className="max-w-md"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                        关闭
                      </Button>
                      <Button 
                        variant="outline" 
                        className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200"
                        onClick={handleReject}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        驳回
                      </Button>
                      <Button 
                        className="bg-green-500 hover:bg-green-600"
                        onClick={handleApprove}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        同意
                      </Button>
                    </div>
                  </>
                )}
                {selectedItem.status !== '一审已通过待二审' && (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                      关闭
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}