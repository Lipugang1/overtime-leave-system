'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ROLE_LABELS, POSITION_OPTIONS, MODULE_OPTIONS, SQUAD_OPTIONS } from '@/lib/auth-shared';
import { Users, Plus, Search, Edit, KeyRound, Trash2 } from 'lucide-react';

export default function EmployeesPage() {
  const { user, fetchWithAuth } = useAuth();
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    username: '', name: '', password: '123456', role_category: '', position: '', department: '', module: '', phone: '', squad: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (moduleFilter && moduleFilter !== 'all') params.set('module', moduleFilter);
    const res = await fetchWithAuth(`/api/employees?${params}`);
    const data = await res.json();
    if (res.ok) setEmployees(data.data || []);
  }, [search, moduleFilter, fetchWithAuth]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const positions = form.role_category ? POSITION_OPTIONS[form.role_category as string] || [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editItem) {
        const res = await fetchWithAuth(`/api/employees/${editItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const res = await fetchWithAuth('/api/employees', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      setDialogOpen(false);
      setEditItem(null);
      setForm({ username: '', name: '', password: '123456', role_category: '', position: '', department: '', module: '', phone: '', squad: '' });
      fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (emp: Record<string, unknown>) => {
    setEditItem(emp);
    setForm({
      username: emp.username as string,
      name: emp.name as string,
      password: '',
      role_category: emp.role_category as string,
      position: emp.position as string,
      department: (emp.department as string) || '',
      module: (emp.module as string) || '',
      squad: (emp.squad as string) || '',
      phone: (emp.phone as string) || '',
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ username: '', name: '', password: '123456', role_category: '', position: '', department: '', module: '', phone: '', squad: '' });
    setDialogOpen(true);
  };

  const toggleActive = async (emp: Record<string, unknown>) => {
    const action = emp.is_active ? '禁用' : '启用';
    if (!confirm(`确认${action}用户 ${emp.name as string}?`)) return;
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !emp.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const resetPassword = async (emp: Record<string, unknown>) => {
    if (!confirm(`确认将 ${emp.name as string} 的密码重置为 123456？`)) return;
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : '重置密码失败');
    }
  };

  const deleteEmployee = async (emp: Record<string, unknown>) => {
    if (!confirm(`确认删除人员 ${emp.name as string}（${emp.username as string}）？删除后该人员的所有数据将被清除，此操作不可恢复！`)) return;
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message || '删除成功');
      fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (user?.role_category !== 'management' && user?.role_category !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">人员管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理系统用户和权限</p>
        </div>
        <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> 添加人员
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索姓名、工号或部门" value={search}
              onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="筛选模块" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模块</SelectItem>
                {MODULE_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">共 {employees.length} 人</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">姓名</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">工号</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">角色分类</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">岗位</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">部门</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">模块</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">工班</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">状态</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p>暂无人员</p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp: Record<string, unknown>) => (
                    <tr key={emp.id as string} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{emp.name as string}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{emp.username as string}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{ROLE_LABELS[emp.role_category as string] || (emp.role_category as string)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{emp.position as string}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{(emp.department as string) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{(emp.module as string) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{(emp.squad as string) || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={emp.is_active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}>
                          {emp.is_active ? '正常' : '已禁用'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} title="编辑">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => resetPassword(emp)} title="重置密码" className="text-amber-600 hover:text-amber-700">
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm"
                            className={emp.is_active ? 'text-red-500 hover:text-red-600' : 'text-green-500 hover:text-green-600'}
                            onClick={() => toggleActive(emp)}>
                            {emp.is_active ? '禁用' : '启用'}
                          </Button>
                          {user?.role_category === 'admin' && (
                            <Button variant="ghost" size="sm" onClick={() => deleteEmployee(emp)} title="删除" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? '编辑人员' : '添加人员'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>工号 *</Label>
              <Input placeholder="请输入工号" value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                disabled={!!editItem} required />
            </div>
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input placeholder="请输入姓名" value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>密码 {editItem ? '(留空不修改)' : ''}</Label>
              <Input type="password" placeholder={editItem ? '留空则不修改' : '默认: 123456'}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                required={!editItem} />
            </div>
            <div className="space-y-2">
              <Label>角色分类 *</Label>
              <Select value={form.role_category}
                onValueChange={(v) => setForm(f => ({ ...f, role_category: v, position: '' }))}
                disabled={!!editItem}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).filter(([k]) => k === 'admin' ? user?.role_category === 'admin' : true).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role_category && (
              <div className="space-y-2">
                <Label>岗位 *</Label>
                <Select value={form.position} onValueChange={(v) => setForm(f => ({ ...f, position: v }))}
                  disabled={!!editItem}>
                  <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>部门</Label>
              <Input placeholder="请输入部门" value={form.department}
                onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>模块</Label>
              <Select value={form.module} onValueChange={(v) => setForm(f => ({ ...f, module: v }))}>
                <SelectTrigger><SelectValue placeholder="请选择所属模块" /></SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role_category === 'production' && (
              <div className="space-y-2">
                <Label>工班 <span className="text-red-500">*</span></Label>
                <Select value={form.squad || ''} onValueChange={(v) => setForm(f => ({ ...f, squad: v }))}>
                  <SelectTrigger><SelectValue placeholder="请选择工班" /></SelectTrigger>
                  <SelectContent>
                    {SQUAD_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>联系电话</Label>
              <Input placeholder="请输入联系电话" value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white" disabled={submitting}>
              {submitting ? '提交中...' : editItem ? '保存修改' : '创建人员'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
