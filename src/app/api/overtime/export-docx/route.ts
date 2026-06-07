import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, TextRun,
  VerticalAlign, ImageRun, HeadingLevel, PageOrientation,
  convertInchesToTwip,
} from 'docx';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function hasCozeStorage(): boolean {
  return !!(process.env.COZE_BUCKET_ENDPOINT_URL && process.env.COZE_BUCKET_NAME);
}

function getStorage() {
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });
}

// 获取签名图片数据（用于 docx ImageRun，支持 Coze S3 和本地文件系统）
async function getSignatureImage(signatureKey: string | null | undefined): Promise<{ data: Buffer; width: number; height: number } | null> {
  if (!signatureKey) return null;
  try {
    let data: Buffer;
    if (hasCozeStorage()) {
      data = Buffer.from(await getStorage().readFile({ fileKey: signatureKey }));
    } else {
      // 本地文件系统回退
      const localPath = signatureKey.startsWith('http')
        ? null
        : path.join(process.cwd(), 'public', signatureKey);
      if (!localPath || !fs.existsSync(localPath)) return null;
      data = fs.readFileSync(localPath);
    }
    return { data, width: 120, height: 40 };
  } catch {
    return null;
  }
}

const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

function makeCell(text: string, opts?: { width?: number; bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; columnSpan?: number; fontSize?: number }): TableCell {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts?.alignment || AlignmentType.CENTER,
      children: [new TextRun({ text, bold: opts?.bold, size: opts?.fontSize || 21, font: '宋体' })],
      spacing: { before: 40, after: 40 },
    })],
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts?.columnSpan,
  } as ConstructorParameters<typeof TableCell>[0]);
}

function makeSignatureCell(signatureImage: { data: Buffer; width: number; height: number } | null, label?: string, width?: number): TableCell {
  const children: Paragraph[] = [];
  if (label) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: label, size: 18, font: '宋体' })],
      spacing: { before: 20, after: 20 },
    }));
  }
  if (signatureImage) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        data: signatureImage.data,
        transformation: { width: signatureImage.width, height: signatureImage.height },
        type: 'png',
      })],
      spacing: { before: 20, after: 20 },
    }));
  } else {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '', size: 21 })],
      spacing: { before: 80, after: 80 },
    }));
  }
  return new TableCell({
    children,
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { record_ids, is_admin_batch } = body as { record_ids: string[]; is_admin_batch?: boolean };

    if (!record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
      return NextResponse.json({ error: '请选择要导出的记录' }, { status: 400 });
    }

    const client = getSupabaseClient();
    let query = client
      .from('overtime_records')
      .select(`
        id, overtime_date, start_time, end_time, hours, description, status, created_at,
        employee:employees!overtime_records_employee_id_fkey(id, name, username, department, position, signature_key),
        selected_level1:employees!overtime_records_selected_level1_approver_id_fkey(name, position, signature_key),
        selected_level2:employees!overtime_records_selected_level2_approver_id_fkey(name, position, signature_key)
      `)
      .in('id', record_ids);

    if (!is_admin_batch && user.role_category !== 'admin') {
      query = query.eq('employee_id', user.id);
    }

    const { data: records, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);
    if (!records || records.length === 0) {
      return NextResponse.json({ error: '未找到记录' }, { status: 404 });
    }

    const sections: Array<NonNullable<ConstructorParameters<typeof Document>[0]['sections']>[number]> = [];

    for (let idx = 0; idx < records.length; idx++) {
      const rec = records[idx];
      const emp = rec.employee as unknown as { id: string; name: string; username: string; department: string; position: string; signature_key: string };
      const level1 = rec.selected_level1 as unknown as { name: string; position: string; signature_key: string } | null;
      const level2 = rec.selected_level2 as unknown as { name: string; position: string; signature_key: string } | null;

      const [applicantSig, level1Sig, level2Sig] = await Promise.all([
        getSignatureImage(emp?.signature_key),
        getSignatureImage(level1?.signature_key),
        getSignatureImage(level2?.signature_key),
      ]);

      const overtimeDate = rec.overtime_date || '';
      const isLevel1Done = ['level1_approved', 'level2_approved', 'approved'].includes(rec.status);
      const isLevel2Done = ['level2_approved', 'approved'].includes(rec.status);
      const isApproved = rec.status === 'approved';
      const isProduction = ['仓管员', '仓储工班长'].includes(emp?.position);

      const rows: TableRow[] = [];

      // Row 0: 部门/室 + 工号
      rows.push(new TableRow({
        children: [
          makeCell('部门/室', { width: 1800, bold: true }),
          makeCell(emp?.department || '', { width: 2400 }),
          makeCell('工号', { width: 1800, bold: true }),
          makeCell(emp?.username || '', { width: 3400 }),
        ],
      }));

      // Row 1: 申请人 + 岗位
      rows.push(new TableRow({
        children: [
          makeCell('申请人', { width: 1800, bold: true }),
          makeCell(emp?.name || '', { width: 2400 }),
          makeCell('岗位', { width: 1800, bold: true }),
          makeCell(emp?.position || '', { width: 3400 }),
        ],
      }));

      // Row 2: 加班日期 + 加班工时
      rows.push(new TableRow({
        children: [
          makeCell('加班日期', { width: 1800, bold: true }),
          makeCell(overtimeDate, { width: 2400 }),
          makeCell('加班工时', { width: 1800, bold: true }),
          makeCell(`${rec.hours || '0'}小时`, { width: 3400 }),
        ],
      }));

      // Row 3: 加班说明
      rows.push(new TableRow({
        children: [
          makeCell('加班说明', { width: 1800, bold: true }),
          makeCell(rec.description || '', { width: 2400, columnSpan: 3, alignment: AlignmentType.LEFT }),
        ],
      }));

      // Row 4: 审批意见
      if (isProduction) {
        rows.push(new TableRow({
          children: [
            makeCell('班组长意见', { width: 1800, bold: true, fontSize: 18 }),
            makeSignatureCell(isLevel1Done ? level1Sig : null, isLevel1Done && level1 ? `${level1.name} 已批准` : undefined, 2400),
            makeCell('', { width: 1800 }),
            makeCell('', { width: 3400 }),
          ],
        }));
      } else {
        rows.push(new TableRow({
          children: [
            makeCell('审批人意见', { width: 1800, bold: true, fontSize: 18 }),
            makeSignatureCell(isLevel1Done ? level1Sig : null, isLevel1Done && level1 ? `${level1.name} 已批准` : undefined, 2400),
            makeCell('', { width: 1800 }),
            makeCell('', { width: 3400 }),
          ],
        }));
      }

      // Row 5: 二级审批
      if (isProduction && emp?.position === '仓储工班长') {
        rows.push(new TableRow({
          children: [
            makeCell('车间/室\n负责人意见', { width: 1800, bold: true, fontSize: 18 }),
            makeSignatureCell(isLevel2Done ? level2Sig : null, isLevel2Done && level2 ? `${level2.name} 已批准` : undefined, 2400),
            makeCell('', { width: 1800 }),
            makeCell('', { width: 3400 }),
          ],
        }));
      } else {
        rows.push(new TableRow({
          children: [
            makeCell('部门负责人\n意见', { width: 1800, bold: true, fontSize: 18 }),
            makeSignatureCell(isLevel2Done ? level2Sig : null, isLevel2Done && level2 ? `${level2.name} 已批准` : undefined, 2400),
            makeCell('', { width: 1800 }),
            makeCell('', { width: 3400 }),
          ],
        }));
      }

      // Row 6: 备注
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: '注：本表单保存期限为长期。', size: 16, font: '宋体' })],
              spacing: { before: 40, after: 40 },
            })],
            columnSpan: 4,
            borders: cellBorders,
          }),
        ],
      }));

      const table = new Table({
        rows,
        width: { size: 9400, type: WidthType.DXA },
      });

      sections.push({
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: convertInchesToTwip(8.27),
              height: convertInchesToTwip(11.69),
            },
            margin: {
              top: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Q/QD-YZ-FB-RL-G103-2024', size: 16, font: '宋体' })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: '员工加班登记单', bold: true, size: 36, font: '宋体' })],
          }),
          new Paragraph({ text: '' }),
          table,
          ...(idx < records.length - 1 ? [new Paragraph({ text: '', pageBreakBefore: true })] : []),
        ],
      });
    }

    const doc = new Document({
      sections,
      styles: { default: { document: { run: { font: '宋体', size: 21 } } } },
    });

    const buffer = await Packer.toBuffer(doc);

    const fileName = records.length === 1
      ? `加班登记单_${(records[0].employee as unknown as { name: string })?.name || 'export'}.docx`
      : `加班登记单_批量导出_${Date.now()}.docx`;

    let downloadUrl: string;

    if (hasCozeStorage()) {
      const storage = getStorage();
      const docxKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `exports/overtime/${fileName}`,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      downloadUrl = await storage.generatePresignedUrl({ key: docxKey, expireTime: 600 });
    } else {
      // 本地文件系统回退
      const exportDir = path.join(process.cwd(), 'public', 'exports', 'overtime');
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      fs.writeFileSync(path.join(exportDir, fileName), buffer);
      downloadUrl = `/exports/overtime/${encodeURIComponent(fileName)}`;
    }

    return NextResponse.json({ download_url: downloadUrl, file_name: fileName });
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
