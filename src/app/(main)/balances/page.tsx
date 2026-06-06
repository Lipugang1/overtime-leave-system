'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scale, Download } from 'lucide-react';

export default function BalancesPage() {
  const { user, fetchWithAuth } = useAuth();
  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetchWithAuth('/api/balances')
      .then(res => res.json())
      .then(data => { if (data.data) setBalances(data.data); })
      .catch(() => {});
  }, [fetchWithAuth]);

  const handleExport = () => {
    // Generate CSV from current data
    const headers = ['姓名', '用户名', '岗位', '部门', '累计加班', '已用调休', '可用余额'];
    const rows = balances.map((b: Record<string, unknown>) => {
      const emp = b.employees as Record<string, unknown>;
      return [
        emp?.name || '',
        emp?.username || '',
        emp?.position || '',
        emp?.department || '',
        b.total_overtime_hours || '0',
        b.used_leave_hours || '0',
        b.remaining_hours || '0',
      ].join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'overtime_balances.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">工时汇总</h1>
          <p className="text-sm text-muted-foreground mt-1">查看加班调休工时汇总</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> 导出
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">姓名</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">岗位</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">部门</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">累计加班(h)</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">已用调休(h)</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">可用余额(h)</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Scale className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p>暂无数据</p>
                    </td>
                  </tr>
                ) : (
                  balances.map((b: Record<string, unknown>) => {
                    const emp = b.employees as Record<string, unknown>;
                    const remaining = parseFloat((b.remaining_hours as string) || '0');
                    return (
                      <tr key={b.id as string} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{emp?.name as string || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">{emp?.position as string || '-'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{emp?.department as string || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-medium text-sky-600">{b.total_overtime_hours as string}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-medium text-amber-600">{b.used_leave_hours as string}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-mono font-bold ${remaining > 0 ? 'text-green-600' : remaining < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                            {b.remaining_hours as string}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
