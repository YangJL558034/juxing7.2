'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  Eye,
  ChevronRight,
  Search,
  Filter,
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

interface ApprovalItem {
  id: number;
  type: 'purchase' | 'expense';
  typeName: string;
  title: string;
  applicantName: string;
  applicantId: number;
  department: string;
  amount: number;
  status: string;
  currentApproverId: number | null;
  currentApproverName: string;
  createTime: string;
  docNo: string;
  items?: Array<{ name: string; quantity: number; price: number; unit_price?: number }>;
  approvals?: ApprovalRecord[];
  proof_file?: string | null;
  proof_file_name?: string | null;
}

interface UserInfo {
  id: number;
  name: string;
  department: string;
}

export default function ApprovalCenter() {
  const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todoItems, setTodoItems] = useState<ApprovalItem[]>([]);
  const [doneItems, setDoneItems] = useState<ApprovalItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  
  // 格式化年月分组
  const formatYearMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };
  
  // 模糊搜索匹配函数
  const matchesSearch = (item: ApprovalItem, query: string) => {
    if (!query.trim()) return true;
    
    const searchLower = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(searchLower) ||
      item.docNo.toLowerCase().includes(searchLower) ||
      item.applicantName.toLowerCase().includes(searchLower) ||
      (item.department && item.department.toLowerCase().includes(searchLower))
    );
  };
  
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

  // 获取当前用户信息
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length >= 2) {
          // 处理 URL-safe base64 编码
          const base64Url = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
          const decoded = JSON.parse(atob(base64Url));
          // 支持多种 token 格式
          const userId = decoded.id || decoded.user?.id || (decoded as any)?.sub || 0;
          console.log('解析到用户ID:', userId);
          setCurrentUserId(userId);
        } else {
          console.error('token格式不正确');
        }
      } catch (e) {
        console.error('解析token失败:', e);
      }
    }
    // 无论如何都尝试获取数据
    setTimeout(() => {
      fetchApprovalItems();
    }, 100);
  }, []);

  // 当用户ID变化时获取审批单据
  useEffect(() => {
    // 即使currentUserId为0也尝试获取，因为后端会根据token验证
    fetchApprovalItems();
  }, [currentUserId]);

  const fetchApprovalItems = async () => {
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
      
      if (!purchaseRes.ok || !expenseRes.ok) {
        throw new Error(`请求失败: purchase=${purchaseRes.status}, expense=${expenseRes.status}`);
      }
      
      const purchaseData = await purchaseRes.json();
      const expenseData = await expenseRes.json();
      
      const purchaseItems: ApprovalItem[] = (purchaseData.requests || []).map((item: any) => ({
        id: Number(item.id),
        type: 'purchase',
        typeName: '请购单',
        title: item.title,
        applicantName: item.applicant_name,
        applicantId: Number(item.applicant_id),
        department: item.department || '',
        amount: Number(item.total_amount) || 0,
        status: item.status || '待审批',
        currentApproverId: item.current_approver_id !== null ? Number(item.current_approver_id) : null,
        currentApproverName: item.current_approver_name || '',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString() : '',
        docNo: item.request_no,
        items: item.items ? JSON.parse(item.items) : undefined,
        approvals: item.approvals || [],
        proof_file: item.proof_file || null,
        proof_file_name: item.proof_file_name || null,
      }));
      
      const expenseItems: ApprovalItem[] = (expenseData.claims || []).map((item: any) => ({
        id: Number(item.id),
        type: 'expense',
        typeName: '报销单',
        title: item.title,
        applicantName: item.applicant_name,
        applicantId: Number(item.applicant_id),
        department: item.department || '',
        amount: Number(item.total_amount) || 0,
        status: item.status || '待审批',
        currentApproverId: item.current_approver_id !== null ? Number(item.current_approver_id) : null,
        currentApproverName: item.current_approver_name || '',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString() : '',
        docNo: item.claim_no,
        items: item.items ? JSON.parse(item.items) : undefined,
        approvals: item.approvals || [],
        proof_file: item.proof_file || null,
        proof_file_name: item.proof_file_name || null,
      }));
      
      const allItems = [...purchaseItems, ...expenseItems];
      
      // 后端已经根据 token 返回了正确的数据（审批中心模式）
      // 只需要按状态分类，不需要再用前端的 currentUserId 筛选
      const todo = allItems.filter(item => 
        item.status !== '已通过' && 
        item.status !== '已驳回'
      );
      
      // 已办单据（后端返回的数据中状态为已通过或已驳回的）
      const done = allItems.filter(item => 
        item.status === '已通过' || item.status === '已驳回'
      );
      
      setTodoItems(todo);
      setDoneItems(done);
    } catch (error) {
      console.error('获取审批列表失败:', error);
      alert('获取审批列表失败，请刷新页面重试');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 自动刷新 - 每20秒更新一次审批数据
  const { refreshNow } = useAutoRefresh({
    enabled: true,
    interval: 20000,
    onRefresh: fetchApprovalItems,
  });

  const handleRefresh = () => {
    refreshNow();
  };

  // 过滤后的待办和已办
  const filteredTodoItems = todoItems.filter(item => matchesSearch(item, searchQuery));
  
  // 已办的按年月分组
  const groupedDoneItems = useMemo(() => {
    const filtered = doneItems.filter(item => matchesSearch(item, searchQuery));
    
    const groups: Record<string, ApprovalItem[]> = {};
    
    filtered.forEach(item => {
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
  }, [doneItems, searchQuery]);
  
  // 监听搜索变化，搜索时自动展开包含结果的月份
  useEffect(() => {
    if (searchQuery.trim() && activeTab === 'done') {
      // 搜索时自动展开所有包含搜索结果的月份
      const monthsToExpand = new Set<string>();
      doneItems.forEach(item => {
        if (matchesSearch(item, searchQuery)) {
          monthsToExpand.add(formatYearMonth(item.createTime));
        }
      });
      setExpandedMonths(monthsToExpand);
    }
  }, [searchQuery, doneItems, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '待审批':
        return 'bg-yellow-100 text-yellow-700';
      case '审批中':
        return 'bg-blue-100 text-blue-700';
      case '一审已通过待二审':
        return 'bg-purple-100 text-purple-700';
      case '财务终审':
        return 'bg-purple-100 text-purple-700';
      case '待财务审核':
        return 'bg-purple-100 text-purple-700';
      case '已通过':
        return 'bg-green-100 text-green-700';
      case '已驳回':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleViewDetail = (item: ApprovalItem) => {
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
        fetchApprovalItems();
      } else {
        alert(data.error || '审批失败');
      }
    } catch (error) {
      console.error('审批失败:', error);
      alert('审批失败，请稍后重试');
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
        fetchApprovalItems();
      } else {
        alert(data.error || '驳回失败');
      }
    } catch (error) {
      console.error('驳回失败:', error);
      alert('驳回失败，请稍后重试');
    }
  };

  const getActionText = (action: string) => {
    return action === 'approved' ? '同意' : action === 'rejected' ? '驳回' : action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">审批中心</h1>
          <p className="text-slate-500 mt-1">统一处理待审批单据</p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">{todoItems.length}</p>
              <p className="text-sm text-slate-500">待审批</p>
            </div>
            <Clock className="w-10 h-10 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">{doneItems.filter(i => i.status === '已通过').length}</p>
              <p className="text-sm text-slate-500">已通过</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red-600">{doneItems.filter(i => i.status === '已驳回').length}</p>
              <p className="text-sm text-slate-500">已驳回</p>
            </div>
            <XCircle className="w-10 h-10 text-red-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-500" />
            {activeTab === 'todo' ? '待我审批' : '已办审批'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索单据..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              筛选
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <Button
                variant={activeTab === 'todo' ? 'default' : 'ghost'}
                size="sm"
                className={activeTab === 'todo' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                onClick={() => setActiveTab('todo')}
              >
                待审批
              </Button>
              <Button
                variant={activeTab === 'done' ? 'default' : 'ghost'}
                size="sm"
                className={activeTab === 'done' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                onClick={() => setActiveTab('done')}
              >
                已办理
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeTab === 'todo' ? (
              // 待审批标签页保持原有显示
              filteredTodoItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FileText className="w-12 h-12 mb-4" />
                  <p>暂无待审批单据</p>
                </div>
              ) : (
                filteredTodoItems.map(item => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => handleViewDetail(item)}
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
                            申请人: {item.applicantName} | 部门: {item.department || '-'} | {item.createTime}
                          </p>
                          <p className="text-sm text-slate-500">
                            当前审批人: {item.currentApproverName || (item.status === '一审已通过待二审' ? '财务终审（管理员）' : '-')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">¥{item.amount.toLocaleString()}</p>
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                    {item.approvals && item.approvals.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-slate-500 mb-2">审批流程:</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.approvals.map((record, index) => (
                            <div key={record.id} className="flex items-center gap-1">
                              {index > 0 && <span className="text-slate-400">→</span>}
                              <Badge className={record.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {record.approver_name}({getActionText(record.action)})
                              </Badge>
                            </div>
                          ))}
                          {item.status !== '已通过' && item.status !== '已驳回' && (
                            <Badge className={item.status === '一审已通过待二审' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}>
                              {item.status === '一审已通过待二审' ? '等待财务终审' : '等待审批'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(item); handleApprove(); }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleViewDetail(item); }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        驳回
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleViewDetail(item); }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看详情
                      </Button>
                    </div>
                  </div>
                ))
              )
            ) : (
              // 已办标签页：按年月折叠显示
              groupedDoneItems.sortedMonths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FileText className="w-12 h-12 mb-4" />
                  <p>暂无已办审批记录</p>
                </div>
              ) : (
                groupedDoneItems.sortedMonths.map(monthKey => {
                  const monthItems = groupedDoneItems.groups[monthKey];
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
                              className="p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={() => handleViewDetail(item)}
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
                                      申请人: {item.applicantName} | 部门: {item.department || '-'} | {item.createTime}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-slate-800">¥{item.amount.toLocaleString()}</p>
                                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-400" />
                                </div>
                              </div>
                              {item.approvals && item.approvals.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm text-slate-500 mb-2">审批流程:</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {item.approvals.map((record, index) => (
                                      <div key={record.id} className="flex items-center gap-1">
                                        {index > 0 && <span className="text-slate-400">→</span>}
                                        <Badge className={record.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                          {record.approver_name}({getActionText(record.action)})
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="mt-3 pt-3 border-t">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); handleViewDetail(item); }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  查看详情
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.type === 'purchase' ? (
                <FileText className="w-5 h-5 text-orange-500" />
              ) : (
                <DollarSign className="w-5 h-5 text-green-500" />
              )}
              {selectedItem?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
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
                    <p className="text-sm text-slate-500">当前审批人</p>
                    <p className="font-medium">{selectedItem.currentApproverName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">申请人</p>
                    <p className="font-medium">{selectedItem.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">所属部门</p>
                    <p className="font-medium">{selectedItem.department || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">申请时间</p>
                    <p className="font-medium">{selectedItem.createTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">总金额</p>
                    <p className="text-xl font-bold text-blue-600">¥{selectedItem.amount.toLocaleString()}</p>
                  </div>
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
                    <p className="text-xs text-slate-400 mt-2">点击下载查看证明文件</p>
                  </div>
                )}

                {selectedItem.approvals && selectedItem.approvals.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">审批历史</p>
                    <div className="space-y-2">
                      {selectedItem.approvals.map((record, index) => (
                        <div 
                          key={record.id}
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            record.action === 'approved' ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            record.action === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{record.approver_name}</span>
                              <Badge variant={record.action === 'approved' ? 'default' : 'destructive'} className="text-xs">
                                {getActionText(record.action)}
                              </Badge>
                            </div>
                            {record.comment && (
                              <p className="text-sm text-slate-600 mt-1">
                                {record.comment}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                              {record.created_at ? new Date(record.created_at).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'todo' && (
                  <div className="space-y-3 mt-4">
                    <div>
                      <p className="text-sm text-slate-500">审批意见</p>
                      <textarea
                        placeholder="请输入审批意见（驳回时必填）"
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                        取消
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!approvalComment.trim()) {
                            alert('驳回时请填写驳回原因');
                            return;
                          }
                          handleReject();
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        disabled={!approvalComment.trim()}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        驳回
                      </Button>
                      <Button
                        onClick={handleApprove}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        同意
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}