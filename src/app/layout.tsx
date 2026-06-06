import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: '部门调休管理平台',
  description: '部门加班调休管理系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
