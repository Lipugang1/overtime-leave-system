import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import fs from 'fs';
import path from 'path';

const SIGNATURE_DIR = path.join(process.cwd(), 'public', 'signatures');

function getCozeStorage() {
  const endpointUrl = process.env.COZE_BUCKET_ENDPOINT_URL;
  const bucketName = process.env.COZE_BUCKET_NAME;
  if (!endpointUrl || !bucketName) return null;
  return new S3Storage({
    endpointUrl,
    accessKey: '',
    secretKey: '',
    bucketName,
    region: 'cn-beijing',
  });
}

// POST: 上传/更新手写签名
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('signature') as File;
    if (!file) {
      return NextResponse.json({ error: '请上传签名图片' }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '签名图片仅支持 PNG/JPG/WebP 格式' }, { status: 400 });
    }

    // 验证文件大小（最大 500KB）
    if (file.size > 500 * 1024) {
      return NextResponse.json({ error: '签名图片大小不能超过 500KB' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1] || 'png';

    const client = getSupabaseClient();
    const { data: emp } = await client
      .from('employees')
      .select('signature_key')
      .eq('id', user.id)
      .single();

    const storage = getCozeStorage();
    let signatureKey: string;

    if (storage) {
      // Coze S3 存储模式
      if (emp?.signature_key) {
        try {
          await storage.deleteFile({ fileKey: emp.signature_key });
        } catch {
          // 旧文件删除失败不影响上传
        }
      }
      signatureKey = await storage.uploadFile({
        fileContent: fileBuffer,
        fileName: `signatures/${user.id}_${Date.now()}.${ext}`,
        contentType: file.type,
      });
    } else {
      // 本地文件系统回退模式
      if (!fs.existsSync(SIGNATURE_DIR)) {
        fs.mkdirSync(SIGNATURE_DIR, { recursive: true });
      }
      // 删除旧签名文件
      if (emp?.signature_key && !emp.signature_key.startsWith('http')) {
        const oldPath = path.join(process.cwd(), 'public', emp.signature_key);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
        }
      }
      const fileName = `signatures/${user.id}_${Date.now()}.${ext}`;
      const localPath = path.join(process.cwd(), 'public', fileName);
      fs.writeFileSync(localPath, fileBuffer);
      signatureKey = fileName;
    }

    // 更新数据库
    const { error } = await client
      .from('employees')
      .update({ signature_key: signatureKey, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw new Error(`保存失败: ${error.message}`);

    return NextResponse.json({ signature_key: signatureKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传签名失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: 获取签名图片URL
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const client = getSupabaseClient();
    const { data: emp } = await client
      .from('employees')
      .select('signature_key')
      .eq('id', user.id)
      .single();

    if (!emp?.signature_key) {
      return NextResponse.json({ signature_url: null, has_signature: false });
    }

    const storage = getCozeStorage();
    let signatureUrl: string;

    if (storage) {
      // Coze S3 模式：生成预签名 URL
      signatureUrl = await storage.generatePresignedUrl({
        key: emp.signature_key,
        expireTime: 3600,
      });
    } else {
      // 本地文件系统模式：直接返回 public 路径
      if (emp.signature_key.startsWith('http')) {
        signatureUrl = emp.signature_key;
      } else {
        signatureUrl = `/${emp.signature_key}`;
      }
    }

    return NextResponse.json({ signature_url: signatureUrl, has_signature: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取签名失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: 删除签名
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const client = getSupabaseClient();
    const { data: emp } = await client
      .from('employees')
      .select('signature_key')
      .eq('id', user.id)
      .single();

    if (emp?.signature_key) {
      const storage = getCozeStorage();
      if (storage) {
        try {
          await storage.deleteFile({ fileKey: emp.signature_key });
        } catch { /* 文件删除失败不影响数据库更新 */ }
      } else if (!emp.signature_key.startsWith('http')) {
        // 本地文件系统模式：删除本地文件
        const localPath = path.join(process.cwd(), 'public', emp.signature_key);
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch { /* ignore */ }
        }
      }
    }

    await client
      .from('employees')
      .update({ signature_key: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除签名失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
