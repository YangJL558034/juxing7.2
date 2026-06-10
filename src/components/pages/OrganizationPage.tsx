'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChinaDateTime } from '@/lib/china-time';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Edit, Trash2, Users, Building2, UserCog } from 'lucide-react';

interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  manager_id: number | null;
  manager_name: string | null;
  created_at: string;
}

interface Position {
  id: number;
  name: string;
  level: number;
  description: string;
  department_id: number | null;
  department_name: string | null;
  can_approve_purchase: number;
  can_approve_expense: number;
  approval_limit: number;
  created_at: string;
}

interface Employee {
  id: number;
  name: string;
  department: string;
  position: string;
  position_id: number | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  location: string;
  status: string;
}

interface SystemUser {
  id: number;
  username: string;
  name: string;
  department: string;
  role: string;
}

export default function OrganizationPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 对话框状态
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 表单数据
  const [deptForm, setDeptForm] = useState({ name: '', parent_id: '', manager_id: '' });
  const [positionForm, setPositionForm] = useState({ name: '', level: 1, description: '', department_id: null as number | null, can_approve_purchase: 0, can_approve_expense: 0, approval_limit: 0 });
  const [employeeForm, setEmployeeForm] = useState({ position_id: '', supervisor_id: '' });

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [deptRes, posRes, empRes, userRes] = await Promise.all([
        fetch('/api/departments', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/positions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const deptData = await deptRes.json();
      const posData = await posRes.json();
      const empData = await empRes.json();
      const userData = await userRes.json();
      
      if (deptData.departments) setDepartments(deptData.departments);
      if (posData.positions) setPositions(posData.positions);
      if (empData.employees) setEmployees(empData.employees);
      if (userData.users) setSystemUsers(userData.users);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 部门操作
  const handleDeptSubmit = async () => {
    if (!deptForm.name) {
      alert('请输入部门名称');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: deptForm.name,
          parent_id: deptForm.parent_id && deptForm.parent_id !== '0' ? parseInt(deptForm.parent_id) : null,
          manager_id: deptForm.manager_id && deptForm.manager_id !== '0' ? parseInt(deptForm.manager_id) : null
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowDeptDialog(false);
        setEditingDept(null);
        setDeptForm({ name: '', parent_id: '', manager_id: '' });
        fetchData();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      alert('操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeptDelete = async (id: number) => {
    if (!confirm('确定要删除这个部门吗？')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 职位操作
  const handlePositionSubmit = async () => {
    if (!positionForm.name) {
      alert('请输入职位名称');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingPosition ? `/api/positions/${editingPosition.id}` : '/api/positions';
      const method = editingPosition ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: positionForm.name,
          level: positionForm.level,
          description: positionForm.description,
          department_id: positionForm.department_id,
          can_approve_purchase: positionForm.can_approve_purchase,
          can_approve_expense: positionForm.can_approve_expense,
          approval_limit: positionForm.approval_limit
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowPositionDialog(false);
        setEditingPosition(null);
        setPositionForm({ name: '', level: 1, description: '', department_id: null, can_approve_purchase: 0, can_approve_expense: 0, approval_limit: 0 });
        fetchData();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      alert('操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePositionDelete = async (id: number) => {
    if (!confirm('确定要删除这个职位吗？')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/positions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 员工上下级设置
  const handleEmployeeSubmit = async () => {
    if (!editingEmployee) return;
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          position_id: employeeForm.position_id ? parseInt(employeeForm.position_id) : null,
          supervisor_id: employeeForm.supervisor_id ? parseInt(employeeForm.supervisor_id) : null
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowEmployeeDialog(false);
        setEditingEmployee(null);
        setEmployeeForm({ position_id: '', supervisor_id: '' });
        fetchData();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      alert('操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 打开编辑部门对话框
  const openDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({
        name: dept.name,
        parent_id: dept.parent_id?.toString() || '',
        manager_id: dept.manager_id?.toString() || ''
      });
    } else {
      setEditingDept(null);
      setDeptForm({ name: '', parent_id: '', manager_id: '' });
    }
    setShowDeptDialog(true);
  };

  // 打开编辑职位对话框
  const openPositionDialog = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setPositionForm({
        name: position.name,
        level: position.level,
        description: position.description || '',
        department_id: position.department_id || null,
        can_approve_purchase: position.can_approve_purchase || 0,
        can_approve_expense: position.can_approve_expense || 0,
        approval_limit: position.approval_limit || 0
      });
    } else {
      setEditingPosition(null);
      setPositionForm({ name: '', level: 1, description: '', department_id: null, can_approve_purchase: 0, can_approve_expense: 0, approval_limit: 0 });
    }
    setShowPositionDialog(true);
  };

  // 打开编辑员工对话框
  const openEmployeeDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      position_id: employee.position_id?.toString() || '',
      supervisor_id: employee.supervisor_id?.toString() || ''
    });
    setShowEmployeeDialog(true);
  };

  // 过滤员工列表
  const filteredEmployees = employees.filter(emp => 
    emp.name.includes(searchTerm) || emp.department?.includes(searchTerm)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-full">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">组织架构管理</h1>

      <Tabs defaultValue="departments" className="w-full">
        <TabsList>
          <TabsTrigger value="departments">
            <Building2 className="w-4 h-4 mr-2" />
            部门管理
          </TabsTrigger>
          <TabsTrigger value="positions">
            <UserCog className="w-4 h-4 mr-2" />
            职位管理
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="w-4 h-4 mr-2" />
            员工上下级设置
          </TabsTrigger>
        </TabsList>

        {/* 部门管理 */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>部门列表</CardTitle>
                <Button onClick={() => openDeptDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增部门
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>部门名称</TableHead>
                    <TableHead>上级部门</TableHead>
                    <TableHead>部门负责人</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.parent_name || '-'}</TableCell>
                      <TableCell>{dept.manager_name || '-'}</TableCell>
                      <TableCell>{formatChinaDateTime(dept.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openDeptDialog(dept)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeptDelete(dept.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        暂无部门数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 职位管理 */}
        <TabsContent value="positions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>职位列表</CardTitle>
                <Button onClick={() => openPositionDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增职位
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>职位名称</TableHead>
                    <TableHead>所属部门</TableHead>
                    <TableHead>职位级别</TableHead>
                    <TableHead>审批权限</TableHead>
                    <TableHead>审批额度</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.sort((a, b) => b.level - a.level).map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell>{pos.department_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={pos.level >= 3 ? 'default' : pos.level >= 2 ? 'secondary' : 'outline'}>
                          Level {pos.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pos.can_approve_purchase === 1 && (
                            <Badge variant="outline" className="text-xs">请购单</Badge>
                          )}
                          {pos.can_approve_expense === 1 && (
                            <Badge variant="outline" className="text-xs">报销</Badge>
                          )}
                          {pos.can_approve_purchase === 0 && pos.can_approve_expense === 0 && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{pos.approval_limit > 0 ? `¥${pos.approval_limit.toLocaleString()}` : '-'}</TableCell>
                      <TableCell>{pos.description || '-'}</TableCell>
                      <TableCell>{formatChinaDateTime(pos.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openPositionDialog(pos)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handlePositionDelete(pos.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {positions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        暂无职位数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 员工上下级设置 */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>员工上下级关系设置</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索员工..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>员工姓名</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>当前职位</TableHead>
                    <TableHead>职位级别</TableHead>
                    <TableHead>直属上级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const position = positions.find(p => p.id === emp.position_id);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.department || '-'}</TableCell>
                        <TableCell>{position?.name || emp.position || '-'}</TableCell>
                        <TableCell>
                          {position && (
                            <Badge variant={position.level >= 3 ? 'default' : position.level >= 2 ? 'secondary' : 'outline'}>
                              Level {position.level}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{emp.supervisor_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={emp.status === '在职' ? 'default' : 'secondary'}>
                            {emp.status || '在职'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => openEmployeeDialog(emp)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        暂无员工数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 部门对话框 */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? '编辑部门' : '新增部门'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>部门名称 *</Label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入部门名称"
              />
            </div>
            <div>
              <Label>上级部门</Label>
              <Select value={deptForm.parent_id} onValueChange={(value) => setDeptForm(prev => ({ ...prev, parent_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="无（顶级部门）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">无（顶级部门）</SelectItem>
                  {departments.filter(d => d.id !== editingDept?.id).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>部门负责人</Label>
              <Select value={deptForm.manager_id} onValueChange={(value) => setDeptForm(prev => ({ ...prev, manager_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">请选择负责人</SelectItem>
                  {systemUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} {user.department ? `(${user.department})` : ''} {user.role === 'admin' ? '[管理员]' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeptDialog(false)}>取消</Button>
            <Button onClick={handleDeptSubmit} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 职位对话框 */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPosition ? '编辑职位' : '新增职位'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>职位名称 *</Label>
              <Input
                value={positionForm.name}
                onChange={(e) => setPositionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入职位名称"
              />
            </div>
            <div>
              <Label>所属部门</Label>
              <Select value={positionForm.department_id?.toString() || ''} onValueChange={(value) => setPositionForm(prev => ({ ...prev, department_id: value === '0' ? null : (value ? parseInt(value) : null) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择部门（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">不指定部门</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>职位级别（数字越大级别越高）</Label>
              <Input
                type="number"
                value={positionForm.level}
                onChange={(e) => setPositionForm(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                placeholder="1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                建议：普通员工=1，主管=2，经理=3，总监=4，高管=5
              </p>
            </div>
            <div>
              <Label>职位描述</Label>
              <Input
                value={positionForm.description}
                onChange={(e) => setPositionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入职位描述"
              />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">审批权限设置</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={positionForm.can_approve_purchase === 1}
                      onChange={(e) => setPositionForm(prev => ({ ...prev, can_approve_purchase: e.target.checked ? 1 : 0 }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    可审批请购单
                  </Label>
                </div>
                <div>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={positionForm.can_approve_expense === 1}
                      onChange={(e) => setPositionForm(prev => ({ ...prev, can_approve_expense: e.target.checked ? 1 : 0 }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    可审批费用报销
                  </Label>
                </div>
              </div>
              <div className="mt-3">
                <Label>审批额度（元）</Label>
                <Input
                  type="number"
                  value={positionForm.approval_limit}
                  onChange={(e) => setPositionForm(prev => ({ ...prev, approval_limit: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">该职位可审批的最大金额</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPositionDialog(false)}>取消</Button>
            <Button onClick={handlePositionSubmit} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 员工上下级设置对话框 */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置员工职位与上级</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 bg-muted">
                <p><strong>员工：</strong>{editingEmployee.name}</p>
                <p><strong>部门：</strong>{editingEmployee.department || '-'}</p>
              </div>
              <div>
                <Label>职位</Label>
                <Select value={employeeForm.position_id} onValueChange={(value) => setEmployeeForm(prev => ({ ...prev, position_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择职位" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.id.toString()}>
                        {pos.name} (Level {pos.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>直属上级</Label>
                <Select value={employeeForm.supervisor_id} onValueChange={(value) => setEmployeeForm(prev => ({ ...prev, supervisor_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择直属上级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无</SelectItem>
                    {employees.filter(e => e.id !== editingEmployee.id).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name} {emp.department ? `(${emp.department})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                提示：审批流程将按照上下级关系自动流转。员工提交申请后，系统会自动发送通知给直属上级审批。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>取消</Button>
            <Button onClick={handleEmployeeSubmit} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
