'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/auth-shared';

interface ApprovalItem {
  id: string;
  type: 'overtime' | 'leave';
  type_label: string;
  employee_name: string;
  employee_position: string;
  employee_department: string;
  start_time: string;
  end_time: string;
  hours: number;
  description?: string;
  reason?: string;
  status: string;
  approval_level: number;
  approval_label: string;
  selected_level1?: string;
  selected_level2?: string;
  selected_level3?: string;
  level1_approver_name?: string;
  level2_approver_name?: string;
  level3_approver_name?: string;
  created_at: string;
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

const TAB_OPTIONS = [
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'all', label: '全部' },
];

export default function ApprovalPage() {
  const { user, fetchWithAuth } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('status_filter', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetchWithAuth(`/api/approval?${params}`);
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      console.error('加载审批列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, fetchWithAuth]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleAction = async (item: ApprovalItem, action: string) => {
    setProcessingId(item.id);
    try {
      const endpoint = item.type === 'overtime' ? `/api/overtime/${item.id}` : `/api/leave/${item.id}`;
      const remark = action.includes('approve') ? '审批通过' : '审批驳回';
      const res = await fetchWithAuth(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remark }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '操作失败');
        return;
      }
      loadItems();
    } catch (err) {
      console.error('审批操作失败:', err);
      alert('操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const getActionLabel = (level: number) => {
    if (level === 1) return '一级审批';
    if (level === 2) return '二级审批';
    return '三级审批';
  };

  const isPendingStatus = (status: string) => ['pending', 'level1_approved', 'level2_approved'].includes(status);

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">审批中心</h1>
          <p className="text-sm text-slate-500 mt-1">处理加班和调休审批，查看审批记录</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">全部类型</option>
            <option value="overtime">加班审批</option>
            <option value="leave">调休审批</option>
          </select>
        </div>
      </div>

      {/* 状态 Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {TAB_OPTIONS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              statusFilter === tab.value
                ? 'bg-white text-slate-800 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {statusFilter === 'pending' ? '暂无待审批事项' : statusFilter === 'approved' ? '暂无已通过记录' : statusFilter === 'rejected' ? '暂无已驳回记录' : '暂无审批记录'}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'overtime' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {item.type === 'overtime' ? '加班' : '调休'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-800'}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{item.employee_name}</span>
                    <span className="text-xs text-slate-400">{item.employee_position}</span>
                  </div>

                  {/* 时间与工时 */}
                  <p className="text-sm text-slate-600 mb-1">
                    {formatTime(item.start_time)} ~ {formatTime(item.end_time)}
                    <span className="ml-2 text-slate-500">({item.hours}h)</span>
                  </p>

                  {/* 描述/原因 */}
                  {(item.description || item.reason) && (
                    <p className="text-xs text-slate-500 mb-2">{item.description || item.reason}</p>
                  )}

                  {/* 审批流程 */}
                  <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-slate-500">审批流:</span>
                    {/* 显示已审批的人 */}
                    {item.level1_approver_name && (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {item.level1_approver_name}(一级)
                      </span>
                    )}
                    {item.level2_approver_name && (
                      <>
                        <span className="text-slate-300">→</span>
                        <span className="text-green-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {item.level2_approver_name}(二级)
                        </span>
                      </>
                    )}
                    {item.level3_approver_name && (
                      <>
                        <span className="text-slate-300">→</span>
                        <span className="text-green-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {item.level3_approver_name}(三级)
                        </span>
                      </>
                    )}
                    {/* 显示待审批的人 */}
                    {item.status === 'pending' && item.selected_level1 && !item.level1_approver_name && (
                      <span className="text-amber-600 font-medium">(待一级: {item.selected_level1})</span>
                    )}
                    {item.status === 'level1_approved' && item.selected_level2 && !item.level2_approver_name && (
                      <>
                        <span className="text-slate-300">→</span>
                        <span className="text-amber-600 font-medium">(待二级: {item.selected_level2})</span>
                      </>
                    )}
                    {item.status === 'level2_approved' && item.selected_level3 && !item.level3_approver_name && (
                      <>
                        <span className="text-slate-300">→</span>
                        <span className="text-amber-600 font-medium">(待三级: {item.selected_level3})</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span>{item.employee_department || ''}</span>
                    <span>申请时间: {new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                {/* 操作按钮 - 仅待审批状态显示 */}
                {isPendingStatus(item.status) && (
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleAction(item, item.approval_level === 1 ? 'level1_approve' : item.approval_level === 2 ? 'level2_approve' : 'level3_approve')}
                      disabled={processingId === item.id}
                      className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 hover:scale-[1.02] disabled:opacity-50 transition-all"
                    >
                      {processingId === item.id ? '处理中...' : `通过${getActionLabel(item.approval_level)}`}
                    </button>
                    <button
                      onClick={() => handleAction(item, 'reject')}
                      disabled={processingId === item.id}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 hover:scale-[1.02] disabled:opacity-50 transition-all"
                    >
                      驳回
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
