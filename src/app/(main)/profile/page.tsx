'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, MODULE_OPTIONS } from '@/lib/auth-shared';
import { User, Lock, Save, CheckCircle2, Pen, Upload, Trash2, Eraser } from 'lucide-react';

export default function ProfilePage() {
  const { user, fetchWithAuth, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: '',
    department: user?.department || '',
    module: '',
    squad: '',
  });
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Signature state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureLoaded, setSignatureLoaded] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Load phone from API on first render
  if (user && !profileLoaded) {
    fetchWithAuth(`/api/employees/${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setProfileForm(prev => ({
            ...prev,
            name: data.data.name || prev.name,
            phone: data.data.phone || '',
            department: data.data.department || prev.department,
            module: data.data.module || '',
            squad: data.data.squad || '',
          }));
        }
      })
      .catch(() => {});
    setProfileLoaded(true);
  }

  // Load signature
  const loadSignature = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/auth/signature');
      if (res.ok) {
        const data = await res.json();
        setHasSignature(data.has_signature);
        setSignatureUrl(data.signature_url);
      }
    } catch {
      // ignore
    }
    setSignatureLoaded(true);
  }, [fetchWithAuth]);

  useEffect(() => {
    if (user && !signatureLoaded) {
      loadSignature();
    }
  }, [user, signatureLoaded, loadSignature]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    // Scale to canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo(x * scaleX, y * scaleY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveCanvasSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setUploadingSig(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('生成签名图片失败');

      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('signature', file);

      const res = await fetchWithAuth('/api/auth/signature', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHasSignature(true);
      await loadSignature();
      setSuccessMsg('签名保存成功');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存签名失败');
    } finally {
      setUploadingSig(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('仅支持 PNG/JPG/WebP 格式的图片');
      return;
    }
    if (file.size > 500 * 1024) {
      alert('签名图片大小不能超过 500KB');
      return;
    }

    setUploadingSig(true);
    try {
      const formData = new FormData();
      formData.append('signature', file);

      const res = await fetchWithAuth('/api/auth/signature', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHasSignature(true);
      await loadSignature();
      setSuccessMsg('签名上传成功');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传签名失败');
    } finally {
      setUploadingSig(false);
    }
  };

  const deleteSignature = async () => {
    if (!confirm('确定要删除签名吗？删除后需要重新设置。')) return;

    try {
      const res = await fetchWithAuth('/api/auth/signature', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setHasSignature(false);
      setSignatureUrl(null);
      setSuccessMsg('签名已删除');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除签名失败');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      await updateProfile({
        name: profileForm.name,
        phone: profileForm.phone || undefined,
        department: profileForm.department || undefined,
        module: profileForm.module || undefined,
        squad: profileForm.squad || undefined,
      });
      setSuccessMsg('个人信息更新成功');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.new_password.length < 4) {
      alert('新密码长度不能少于4位');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setSuccessMsg('密码修改成功');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">个人中心</h1>
        <p className="text-sm text-muted-foreground mt-1">管理您的账户信息、密码和签名</p>
      </div>

      {/* User Info Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center text-2xl font-bold text-sky-600">
              {user.name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-800">{user.name}</h2>
              <p className="text-sm text-muted-foreground">工号: {user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{ROLE_LABELS[user.role_category]}</Badge>
                <Badge variant="outline" className="text-xs">{user.position}</Badge>
              </div>
            </div>
            {hasSignature && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" /> 已设置签名
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="w-4 h-4" /> 个人信息
          </TabsTrigger>
          <TabsTrigger value="signature" className="gap-1.5">
            <Pen className="w-4 h-4" /> 手写签名
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-1.5">
            <Lock className="w-4 h-4" /> 修改密码
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">编辑个人信息</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="请输入姓名"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>联系电话</Label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="请输入联系电话"
                  />
                </div>
                <div className="space-y-2">
                  <Label>部门</Label>
                  <Input
                    value={profileForm.department}
                    onChange={(e) => setProfileForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="请输入部门"
                  />
                </div>
                <div className="space-y-2">
                  <Label>模块</Label>
                  <Select value={profileForm.module} onValueChange={(v) => setProfileForm(f => ({ ...f, module: v }))}>
                    <SelectTrigger><SelectValue placeholder="请选择所属模块" /></SelectTrigger>
                    <SelectContent>
                      {MODULE_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {user?.role_category === 'production' && user?.squad && (
                  <div className="space-y-2">
                    <Label>工班</Label>
                    <Input value={user.squad} disabled className="bg-slate-50" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>工号</Label>
                  <Input value={user.username} disabled className="bg-slate-50" />
                  <p className="text-xs text-muted-foreground">工号不可修改</p>
                </div>
                <div className="space-y-2">
                  <Label>岗位</Label>
                  <Input value={`${ROLE_LABELS[user.role_category]} - ${user.position}`} disabled className="bg-slate-50" />
                  <p className="text-xs text-muted-foreground">岗位信息需由管理员修改</p>
                </div>
                <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? '保存中...' : '保存修改'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signature Tab */}
        <TabsContent value="signature">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">手写签名</CardTitle>
              <p className="text-sm text-muted-foreground">
                请在下方画板中手写签名，或上传签名图片。签名将用于导出调休申请单和加班登记单。
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current signature preview */}
              {hasSignature && signatureUrl && (
                <div className="space-y-2">
                  <Label>当前签名</Label>
                  <div className="border rounded-lg p-4 bg-white">
                    <img
                      src={signatureUrl}
                      alt="当前签名"
                      className="h-16 object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={deleteSignature}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> 删除签名
                    </Button>
                  </div>
                </div>
              )}

              {/* Drawing canvas */}
              <div className="space-y-2">
                <Label>手写签名画板</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-1 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full h-32 cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-xs text-muted-foreground">用鼠标或手指在上方画板中书写签名</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCanvas}
                  >
                    <Eraser className="w-4 h-4 mr-1" /> 清除画板
                  </Button>
                  <Button
                    size="sm"
                    className="bg-sky-500 hover:bg-sky-600 text-white"
                    onClick={saveCanvasSignature}
                    disabled={!hasDrawn || uploadingSig}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {uploadingSig ? '保存中...' : '保存签名'}
                  </Button>
                </div>
              </div>

              {/* Upload signature */}
              <div className="space-y-2">
                <Label>或上传签名图片</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    disabled={uploadingSig}
                    className="max-w-xs"
                  />
                </div>
                <p className="text-xs text-muted-foreground">支持 PNG/JPG/WebP 格式，大小不超过 500KB</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">修改密码</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>旧密码</Label>
                  <Input
                    type="password"
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, old_password: e.target.value }))}
                    placeholder="请输入当前密码"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>新密码</Label>
                  <Input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                    placeholder="请输入新密码（至少4位）"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>确认新密码</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                    placeholder="请再次输入新密码"
                    required
                  />
                </div>
                <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white" disabled={saving}>
                  <Lock className="w-4 h-4 mr-1" />
                  {saving ? '修改中...' : '修改密码'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
