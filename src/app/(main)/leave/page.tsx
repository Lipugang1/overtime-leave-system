'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/auth-shared';
import { FileDown } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  username: string;
  position: string;
  department: string;
  module: string;
}

interface Approver {
  id: string;
  name: string;
  position: string;
}

interface LeaveRecord {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  hours: string;
  reason: string;
  status: string;
  created_at: string;
  employee?: Employee;
  level1_approver_name?: string;
  level2_approver_name?: string;
  level3_approver_name?: string;
  selected_level1?: { name: string };
  selected_level2?: { name: string };
  selected_level3?: { name: string };
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  level1_approved: '一级已批',
  level2_approved: '二级已批',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  level1_approved: 'bg-blue-100 text-blue-800',
  level2_approved: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-100 text-slate-500',
};

export default function LeavePage() {
  const { user, fetchWithAuth } = useAuth();
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvers, setApprovers] = useState<Record<string, Approver[]>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editRecord, setEditRecord] = useState<LeaveRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    employee_id: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    hours: '',
    reason: '',
    selected_level1_approver_id: '',
    selected_level2_approver_id: '',
    selected_level3_approver_id: '',
  });

  const [editForm, setEditForm] = useState({
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    hours: '',
    reason: '',
  });

  const loadRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetchWithAuth(`/api/leave?${params}`);
      const data = await res.json();
      setRecords(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('加载调休记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const loadEmployees = async () => {
    try {
      const res = await fetchWithAuth('/api/employees?pageSize=100');
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('加载员工列表失败:', err);
    }
  };

  const loadApprovers = async (position: string, hours?: number) => {
    try {
      const params = new URLSearchParams({ position, is_leave: 'true' });
      if (hours !== undefined) params.set('hours', String(hours));
      const res = await fetchWithAuth(`/api/approvers?${params}`);
      const data = await res.json();
      setApprovers(data.approvers || {});
    } catch (err) {
      console.error('加载审批人失败:', err);
    }
  };

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { if (showDialog) loadEmployees(); }, [showDialog]);

  const handleOpenDialog = async () => {
    setForm({
      employee_id: isAdmin(user) ? '' : user!.id,
      start_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_date: new Date().toISOString().split('T')[0],
      end_time: '18:00',
      hours: '',
      reason: '',
      selected_level1_approver_id: '',
      selected_level2_approver_id: '',
      selected_level3_approver_id: '',
    });
    if (!isAdmin(user)) {
      await loadApprovers(user!.position);
    } else {
      setApprovers({});
    }
    setShowDialog(true);
  };

  const handleEmployeeChange = async (empId: string) => {
    setForm(prev => ({ ...prev, employee_id: empId, selected_level1_approver_id: '', selected_level2_approver_id: '', selected_level3_approver_id: '' }));
    if (isAdmin(user) && empId) {
      const emp = employees.find(e => e.id === empId);
      if (emp) await loadApprovers(emp.position, parseFloat(form.hours) || undefined);
    }
  };

  const handleHoursChange = async (hours: string) => {
    setForm(prev => ({ ...prev, hours, selected_level1_approver_id: '', selected_level2_approver_id: '', selected_level3_approver_id: '' }));
    const h = parseFloat(hours);
    if (h > 0) {
      const position = isAdmin(user) && form.employee_id
        ? employees.find(e => e.id === form.employee_id)?.position
        : user?.position;
      if (position) await loadApprovers(position, h);
    }
  };

  // 表单验证：必填字段检查
  const isFormValid = () => {
    if (!form.start_date) return false;
    if (!form.start_time) return false;
    if (!form.end_date) return false;
    if (!form.end_time) return false;
    if (!form.hours || parseFloat(form.hours) <= 0) return false;
    // 必须选择审批人（如果有审批人可选）
    if (approvers.level1 && approvers.level1.length > 0 && !form.selected_level1_approver_id) return false;
    if (approvers.level2 && approvers.level2.length > 0 && !form.selected_level2_approver_id) return false;
    if (approvers.level3 && approvers.level3.length > 0 && !form.selected_level3_approver_id) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      alert('请填写完整信息：开始时间、结束时间、工时和审批人均为必填项');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        start_time: `${form.start_date}T${form.start_time}:00`,
        end_time: `${form.end_date}T${form.end_time}:00`,
        hours: form.hours,
        reason: form.reason,
      };
      if (isAdmin(user) && form.employee_id) body.employee_id = form.employee_id;
      if (form.selected_level1_approver_id) body.selected_level1_approver_id = form.selected_level1_approver_id;
      if (form.selected_level2_approver_id) body.selected_level2_approver_id = form.selected_level2_approver_id;
      if (form.selected_level3_approver_id) body.selected_level3_approver_id = form.selected_level3_approver_id;

      const res = await fetchWithAuth('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '申请失败');
        return;
      }
      setShowDialog(false);
      loadRecords();
    } catch (err) {
      console.error('申请调休失败:', err);
      alert('申请失败');
    }
  };

  const handleEdit = (record: LeaveRecord) => {
    setEditRecord(record);
    const st = new Date(record.start_time);
    const et = new Date(record.end_time);
    setEditForm({
      start_date: st.toISOString().split('T')[0],
      start_time: st.toTimeString().slice(0, 5),
      end_date: et.toISOString().split('T')[0],
      end_time: et.toTimeString().slice(0, 5),
      hours: record.hours,
      reason: record.reason || '',
    });
    // 员工编辑自己的记录时，加载审批人
    if (record.employee_id === user?.id && !isAdmin(user) && record.employee?.position) {
      loadApprovers(record.employee.position, parseFloat(record.hours) || undefined);
    }
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editRecord) return;
    try {
      const isOwner = editRecord.employee_id === user?.id;
      const body: Record<string, unknown> = {
        action: 'edit',
        start_time: `${editForm.start_date}T${editForm.start_time}:00`,
        end_time: `${editForm.end_date}T${editForm.end_time}:00`,
        hours: editForm.hours,
        reason: editForm.reason,
      };
      // 员工编辑自己的记录时，需要提交审批人
      if (isOwner && !isAdmin(user)) {
        if (form.selected_level1_approver_id) body.selected_level1_approver_id = form.selected_level1_approver_id;
        if (form.selected_level2_approver_id) body.selected_level2_approver_id = form.selected_level2_approver_id;
        if (form.selected_level3_approver_id) body.selected_level3_approver_id = form.selected_level3_approver_id;
      }
      const res = await fetchWithAuth(`/api/leave/${editRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '编辑失败');
        return;
      }
      setShowEditDialog(false);
      loadRecords();
    } catch (err) {
      console.error('编辑失败:', err);
      alert('编辑失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/leave/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '删除失败');
        return;
      }
      setConfirmDelete(null);
      loadRecords();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败');
    }
  };

  const handleWithdraw = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/leave/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '撤回失败');
        return;
      }
      setConfirmWithdraw(null);
      loadRecords();
    } catch (err) {
      console.error('撤回失败:', err);
      alert('撤回失败');
    }
  };

  const totalPages = Math.ceil(total / 20);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const handleExportDocx = async (recordIds?: string[]) => {
    const ids = recordIds || Array.from(selectedIds);
    if (ids.length === 0) {
      alert('请先选择要导出的记录');
      return;
    }
    setExporting(true);
    try {
      const res = await fetchWithAuth('/api/leave/export-docx', {
        method: 'POST',
        body: JSON.stringify({ record_ids: ids, is_admin_batch: isAdmin(user) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Download file
      const response = await fetch(data.download_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = data.file_name || '调休申请单.docx';
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">调休管理</h1>
          <p className="text-sm text-slate-500 mt-1">申请和管理调休</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={handleOpenDialog} className="bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors">
            + 申请调休
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleExportDocx()}
              disabled={exporting}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              {exporting ? '导出中...' : `导出申请单(${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-slate-400">暂无调休记录</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-slate-600 w-10">
                    <input type="checkbox" checked={records.length > 0 && selectedIds.size === records.length} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">姓名</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">岗位</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">开始时间</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">结束时间</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">工时</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">原因</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">审批人</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">{r.employee?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.employee?.position || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.start_time ? new Date(r.start_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.end_time ? new Date(r.end_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3 font-mono font-medium">{r.hours}h</td>
                    <td className="px-4 py-3 text-slate-500 max-w-32 truncate">{r.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {[r.selected_level1?.name, r.selected_level2?.name, r.selected_level3?.name].filter(Boolean).join(' → ') || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.employee_id === user?.id && r.status === 'pending' && (
                          <>
                            <button onClick={() => handleEdit(r)} className="text-sky-500 hover:text-sky-700 text-xs font-medium">编辑</button>
                            <button onClick={() => setConfirmWithdraw(r.id)} className="text-amber-600 hover:text-amber-800 text-xs font-medium">撤回</button>
                          </>
                        )}
                        {isAdmin(user) && (
                          <>
                            <button onClick={() => handleEdit(r)} className="text-sky-500 hover:text-sky-700 text-xs font-medium">编辑</button>
                            <button onClick={() => setConfirmDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">删除</button>
                          </>
                        )}
                        <button onClick={() => handleExportDocx([r.id])} disabled={exporting} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium disabled:opacity-50">导出</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500">共 {total} 条</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">上一页</button>
                <span className="text-sm text-slate-600">{page}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 新建调休对话框 */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">申请调休</h2>
            </div>
            <div className="p-6 space-y-4">
              {isAdmin(user) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">员工</label>
                  <select value={form.employee_id} onChange={e => handleEmployeeChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">选择员工</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.position})</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">开始日期</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.start_date ? 'border-red-300' : 'border-slate-200'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">开始时间 <span className="text-red-500">*</span></label>
                  <input type="time" value={form.start_time} onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.start_time ? 'border-red-300' : 'border-slate-200'}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">结束日期</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.end_date ? 'border-red-300' : 'border-slate-200'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">结束时间 <span className="text-red-500">*</span></label>
                  <input type="time" value={form.end_time} onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.end_time ? 'border-red-300' : 'border-slate-200'}`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">调休工时(小时) <span className="text-red-500">*</span></label>
                <input type="number" step="0.5" min="0.5" value={form.hours} onChange={e => handleHoursChange(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.hours || parseFloat(form.hours) <= 0 ? 'border-red-300' : 'border-slate-200'}`} placeholder="例如: 8" />
                {form.hours && parseFloat(form.hours) > 0 && (
                  <p className="text-xs text-slate-400 mt-1">约 {(parseFloat(form.hours) / 8).toFixed(1)} 天</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">调休原因</label>
                <textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="请输入调休原因" />
              </div>

              {/* 审批人选择 */}
              {approvers.level1 && approvers.level1.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">一级审批人 <span className="text-red-500">*</span></label>
                  <select value={form.selected_level1_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level1_approver_id: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.selected_level1_approver_id ? 'border-red-300' : 'border-slate-200'}`}>
                    <option value="">选择一级审批人</option>
                    {approvers.level1.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                  </select>
                </div>
              )}
              {approvers.level2 && approvers.level2.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">二级审批人 <span className="text-red-500">*</span></label>
                  <select value={form.selected_level2_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level2_approver_id: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.selected_level2_approver_id ? 'border-red-300' : 'border-slate-200'}`}>
                    <option value="">选择二级审批人</option>
                    {approvers.level2.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                  </select>
                </div>
              )}
              {approvers.level3 && approvers.level3.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">三级审批人 <span className="text-red-500">*</span></label>
                  <select value={form.selected_level3_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level3_approver_id: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${!form.selected_level3_approver_id ? 'border-red-300' : 'border-slate-200'}`}>
                    <option value="">选择三级审批人</option>
                    {approvers.level3.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowDialog(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">取消</button>
              <button onClick={handleSubmit} disabled={!isFormValid()} className="px-4 py-2 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed">确认申请</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑对话框 */}
      {showEditDialog && editRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">编辑调休记录</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">开始日期</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(prev => ({ ...prev, start_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">开始时间</label>
                  <input type="time" value={editForm.start_time} onChange={e => setEditForm(prev => ({ ...prev, start_time: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">结束日期</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(prev => ({ ...prev, end_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">结束时间</label>
                  <input type="time" value={editForm.end_time} onChange={e => setEditForm(prev => ({ ...prev, end_time: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">工时(小时)</label>
                <input type="number" step="0.5" min="0.5" value={editForm.hours} onChange={e => setEditForm(prev => ({ ...prev, hours: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">原因</label>
                <textarea value={editForm.reason} onChange={e => setEditForm(prev => ({ ...prev, reason: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              {/* 员工编辑自己记录时显示审批人选择 */}
              {editRecord.employee_id === user?.id && !isAdmin(user) && (
                <>
                  {approvers.level1 && approvers.level1.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">一级审批人</label>
                      <select value={form.selected_level1_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level1_approver_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">选择一级审批人</option>
                        {approvers.level1.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                      </select>
                    </div>
                  )}
                  {approvers.level2 && approvers.level2.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">二级审批人</label>
                      <select value={form.selected_level2_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level2_approver_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">选择二级审批人</option>
                        {approvers.level2.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                      </select>
                    </div>
                  )}
                  {approvers.level3 && approvers.level3.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">三级审批人</label>
                      <select value={form.selected_level3_approver_id} onChange={e => setForm(prev => ({ ...prev, selected_level3_approver_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">选择三级审批人</option>
                        {approvers.level3.map(a => <option key={a.id} value={a.id}>{a.name} ({a.position})</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowEditDialog(false)} className="px-4 py-2 text-sm text-slate-600">取消</button>
              <button onClick={handleEditSubmit} className="px-4 py-2 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 撤回确认 */}
      {confirmWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认撤回</h3>
            <p className="text-sm text-slate-500 mb-4">撤回后该调休申请将取消审批，您可重新编辑提交。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmWithdraw(null)} className="px-4 py-2 text-sm text-slate-600">取消</button>
              <button onClick={() => handleWithdraw(confirmWithdraw)} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">确认撤回</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 mb-4">删除后将恢复工时余额，此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-slate-600">取消</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
