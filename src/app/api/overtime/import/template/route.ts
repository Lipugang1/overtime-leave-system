import { NextResponse } from 'next/server';
export async function GET() {
  const csv = `username,overtime_date,hours,description
zhangsan,2024-01-15,4,周末值班
lisi,2024-01-16,8,节假日加班`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=overtime_import_template.csv',
    },
  });
}
