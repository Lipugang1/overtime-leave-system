'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POSITION_OPTIONS, REGISTER_ROLE_LABELS, MODULE_OPTIONS, SQUAD_OPTIONS } from '@/lib/auth-shared';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    password: '123456',
    name: '',
    role_category: '',
    position: '',
    department: '物资仓储部',
    module: '',
    squad: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const positions = form.role_category ? POSITION_OPTIONS[form.role_category] || [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-14 h-14 bg-sky-500 rounded-xl flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">注册账号</CardTitle>
          <CardDescription>创建您的调休管理系统账号</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">工号 *</Label>
              <Input id="username" placeholder="请输入工号" value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input id="name" placeholder="请输入真实姓名" value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">默认密码: 123456</p>
            </div>
            <div className="space-y-2">
              <Label>角色分类 *</Label>
              <Select value={form.role_category} onValueChange={(v) => setForm(f => ({ ...f, role_category: v, position: '' }))}>
                <SelectTrigger><SelectValue placeholder="请选择角色分类" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGISTER_ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role_category && (
              <div className="space-y-2">
                <Label>岗位 *</Label>
                <Select value={form.position} onValueChange={(v) => setForm(f => ({ ...f, position: v }))}>
                  <SelectTrigger><SelectValue placeholder="请选择岗位" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="department">部门</Label>
              <Input id="department" placeholder="请输入部门" value={form.department}
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
                <Select value={form.squad} onValueChange={(v) => setForm(f => ({ ...f, squad: v }))}>
                  <SelectTrigger><SelectValue placeholder="请选择所属工班" /></SelectTrigger>
                  <SelectContent>
                    {SQUAD_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white" disabled={loading}>
              {loading ? '注册中...' : '注 册'}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              已有账号？{' '}
              <Link href="/login" className="text-sky-500 hover:text-sky-600 font-medium">
                返回登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
