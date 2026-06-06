'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Users, Clock, FileText, Download, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
  message?: string;
}

export default function ImportPage() {
  const { user, fetchWithAuth } = useAuth();
  const [employeeFile, setEmployeeFile] = useState<File | null>(null);
  const [overtimeFile, setOvertimeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (user?.role_category !== 'management' && user?.role_category !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问此页面</p>
      </div>
    );
  }

  const handleImportEmployees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFile) return;
    setUploading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', employeeFile);
      const res = await fetchWithAuth('/api/employees/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '导入失败');
      setResult({
        success: data.success || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
        message: data.message,
      });
      setEmployeeFile(null);
      // 清空文件输入框
      const input = document.getElementById('employee-file') as HTMLInputElement;
      if (input) input.value = '';
    } catch (err) {
      setErrorMsg(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImportOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeFile) return;
    setUploading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', overtimeFile);
      const res = await fetchWithAuth('/api/overtime/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '导入失败');
      setResult({
        success: data.success || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
        message: data.message,
      });
      setOvertimeFile(null);
      const input = document.getElementById('overtime-file') as HTMLInputElement;
      if (input) input.value = '';
    } catch (err) {
      setErrorMsg(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async (url: string, filename: string) => {
    try {
      const response = await fetchWithAuth(url);
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setErrorMsg('模板下载失败，请重试');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">数据导入</h1>
        <p className="text-sm text-muted-foreground mt-1">批量导入人员信息和加班工时</p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">
            <Users className="w-4 h-4 mr-1" /> 人员信息导入
          </TabsTrigger>
          <TabsTrigger value="overtime">
            <Clock className="w-4 h-4 mr-1" /> 加班工时导入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">人员信息导入</CardTitle>
              <CardDescription>
                上传CSV文件批量导入人员信息。请先下载模板，按模板格式填写后再上传。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportEmployees} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-file">选择CSV文件</Label>
                  <Input id="employee-file" type="file" accept=".csv,.txt" onChange={(e) => setEmployeeFile(e.target.files?.[0] || null)} />
                  {employeeFile && (
                    <p className="text-xs text-slate-500">已选择: {employeeFile.name} ({(employeeFile.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white" disabled={!employeeFile || uploading}>
                    <Upload className="w-4 h-4 mr-1" /> {uploading ? '导入中...' : '开始导入'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadTemplate('/api/employees/import/template', '人员信息导入模板.csv')}>
                    <Download className="w-4 h-4 mr-1" /> 下载模板
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">加班工时导入</CardTitle>
              <CardDescription>
                上传CSV文件批量导入历史加班工时。导入的加班记录自动标记为已审批状态。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportOvertime} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="overtime-file">选择CSV文件</Label>
                  <Input id="overtime-file" type="file" accept=".csv,.txt" onChange={(e) => setOvertimeFile(e.target.files?.[0] || null)} />
                  {overtimeFile && (
                    <p className="text-xs text-slate-500">已选择: {overtimeFile.name} ({(overtimeFile.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white" disabled={!overtimeFile || uploading}>
                    <Upload className="w-4 h-4 mr-1" /> {uploading ? '导入中...' : '开始导入'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadTemplate('/api/overtime/import/template', '加班工时导入模板.csv')}>
                    <Download className="w-4 h-4 mr-1" /> 下载模板
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 导入结果展示 */}
      {result && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {result.message && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm font-medium">{result.message}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-lg font-bold text-green-700">{result.success}</div>
                    <div className="text-xs text-green-600">成功导入</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <div className="text-lg font-bold text-amber-700">{result.skipped}</div>
                    <div className="text-xs text-amber-600">跳过（已存在）</div>
                  </div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">错误详情 ({result.errors.length}条)</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 pl-6">{err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {errorMsg && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{errorMsg}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
