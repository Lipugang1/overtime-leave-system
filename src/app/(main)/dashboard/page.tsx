'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarOff, CheckSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  balance: { total_overtime_hours: string; used_leave_hours: string; remaining_hours: string };
  pendingApprovals: number;
  recentOvertime: Array<Record<string, unknown>>;
  recentLeave: Array<Record<string, unknown>>;
  totalEmployees: number;
}

const statusLabels: Record<string, string> = {
  pending: '待审批',
  level1_approved: '一级已审批',
  approved: '已通过',
  rejected: '已驳回',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  level1_approved: 'bg-blue-50 text-blue-600 border-blue-200',
  approved: 'bg-green-50 text-green-600 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

export default function DashboardPage() {
  const { user, fetchWithAuth } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchWithAuth('/api/dashboard')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(() => {});
  }, [fetchWithAuth]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isApprover = user?.role_category === 'admin' || user?.role_category === 'management' || user?.position === '仓储工班长';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">工作台</h1>
        <p className="text-sm text-muted-foreground mt-1">
          欢迎回来，{user?.name} ({user?.position})
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">累计加班</p>
                <p className="text-2xl font-bold text-slate-800 font-mono">{data.balance.total_overtime_hours}h</p>
              </div>
              <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已用调休</p>
                <p className="text-2xl font-bold text-slate-800 font-mono">{data.balance.used_leave_hours}h</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">可用余额</p>
                <p className="text-2xl font-bold text-slate-800 font-mono">{data.balance.remaining_hours}h</p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isApprover && (
          <Link href="/approval">
            <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待审批</p>
                    <p className="text-2xl font-bold text-slate-800 font-mono">{data.pendingApprovals}</p>
                  </div>
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <CheckSquare className="w-5 h-5 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {!isApprover && (
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">在职人员</p>
                  <p className="text-2xl font-bold text-slate-800 font-mono">{data.totalEmployees}</p>
                </div>
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">最近加班记录</CardTitle>
              <Link href="/overtime" className="text-sm text-sky-500 hover:text-sky-600">查看全部</Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentOvertime.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">暂无加班记录</p>
            ) : (
              <div className="space-y-3">
                {data.recentOvertime.map((r: Record<string, unknown>) => (
                  <div key={r.id as string} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{r.overtime_date as string}</p>
                      <p className="text-xs text-muted-foreground">{(r.description as string) || '无备注'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium">{r.hours as string}h</span>
                      <Badge variant="outline" className={statusColors[r.status as string] || ''}>
                        {statusLabels[r.status as string] || (r.status as string)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">最近调休记录</CardTitle>
              <Link href="/leave" className="text-sm text-sky-500 hover:text-sky-600">查看全部</Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentLeave.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">暂无调休记录</p>
            ) : (
              <div className="space-y-3">
                {data.recentLeave.map((r: Record<string, unknown>) => (
                  <div key={r.id as string} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {r.start_time ? new Date(r.start_time as string).toLocaleDateString('zh-CN') : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{(r.reason as string) || '无原因'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium">{r.hours as string}h</span>
                      <Badge variant="outline" className={statusColors[r.status as string] || ''}>
                        {statusLabels[r.status as string] || (r.status as string)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
