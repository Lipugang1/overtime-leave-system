// 安全的客户端认证工具 - 不依赖 next/headers

// ===== JWT 密钥 =====
// 使用固定密钥确保所有 API 路由的签名/验证一致
const JWT_FALLBACK_SECRET = 'overtime-system-jwt-secret-key-fixed';

// ===== 角色分类 =====
export const ROLE_CATEGORIES = ['admin', 'functional_tech', 'management', 'production'] as const;
export type RoleCategory = typeof ROLE_CATEGORIES[number];

// ===== 注册页可用的角色（不含admin）=====
export const REGISTER_ROLE_LABELS: Record<string, string> = {
  functional_tech: '职能技术岗',
  management: '管理岗',
  production: '生产岗',
};

// ===== 全部角色标签 =====
export const ROLE_LABELS: Record<string, string> = {
  admin: '超级管理员',
  functional_tech: '职能技术岗',
  management: '管理岗',
  production: '生产岗',
};

// ===== 岗位选项（按角色分类）=====
export const POSITION_OPTIONS: Record<string, string[]> = {
  admin: ['系统管理员'],
  functional_tech: ['仓储工作岗', '安全工作岗', '综合事务岗', '物资工作岗', '招标采购岗', '合同工作岗', '其他职能技术岗'],
  management: ['经理', '副经理', '经理助理'],
  production: ['仓管员', '仓储工班长'],
};

// ===== 全部岗位列表 =====
export const ALL_POSITIONS = Object.values(POSITION_OPTIONS).flat();

// ===== 岗位→角色映射 =====
export const POSITION_ROLE_MAP: Record<string, string> = {};
Object.entries(POSITION_OPTIONS).forEach(([role, positions]) => {
  positions.forEach(pos => { POSITION_ROLE_MAP[pos] = role; });
});

// ===== 模块选项 =====
export const MODULE_OPTIONS = ['仓储物流模块', '物资计划模块', '物资采购模块', '综合模块'] as const;

// ===== 工班选项 =====
export const SQUAD_OPTIONS = ['东部储运工班', '南部储运工班', '西部储运工班'] as const;

// ===== 默认部门 =====
export const DEFAULT_DEPARTMENT = '物资仓储部';

// ===== 状态标签 =====
export const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  level1_approved: '一级审批通过',
  level2_approved: '二级审批通过',
  approved: '已通过',
  rejected: '已驳回',
};

// ===== JWT 常量 =====
export const JWT_SECRET = JWT_FALLBACK_SECRET;
export const JWT_EXPIRES_IN = '7d';
export const COOKIE_NAME = 'auth_token';

// ===== AuthUser 类型 =====
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role_category: RoleCategory | string;
  position: string;
  department: string | null;
  module: string | null;
  squad: string | null;
}

// ===== 角色判断工具 =====
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role_category === 'admin';
}

export function isManagerial(user: AuthUser | null): boolean {
  return user?.role_category === 'admin' || user?.role_category === 'management';
}

export function isForeman(user: AuthUser | null): boolean {
  return user?.position === '仓储工班长';
}

// 获取用户可查看数据的范围
export function getDataScope(user: AuthUser | null): { type: 'all' | 'module' | 'squad' | 'self'; module?: string; squad?: string } {
  if (!user) return { type: 'self' };
  if (isAdmin(user)) return { type: 'all' };
  if (isManagerial(user)) return { type: 'module', module: user.module || undefined };
  if (isForeman(user)) return { type: 'squad', squad: user.squad || undefined };
  return { type: 'self' };
}

export function canManageEmployees(user: AuthUser | null): boolean {
  return isAdmin(user) || isManagerial(user);
}

// ===== 审批规则引擎 =====
export interface ApprovalRule {
  levels: number; // 需要几级审批
  level1Approvers: string[]; // 一级可选审批人岗位
  level2Approvers: string[]; // 二级可选审批人岗位
  level3Approvers: string[]; // 三级可选审批人岗位
}

/**
 * 根据申请人岗位和调休天数计算审批规则
 * @param position 申请人岗位
 * @param leaveHours 调休小时数（加班审批不区分天数，默认1级）
 * @param isLeave 是否为调休（加班默认1级审批）
 */
export function getApprovalRule(position: string, leaveHours: number, isLeave: boolean): ApprovalRule {
  // 默认规则（加班也走此规则，但加班默认1级）
  const defaultRule: ApprovalRule = {
    levels: 1,
    level1Approvers: ['经理', '副经理', '经理助理'],
    level2Approvers: [],
    level3Approvers: [],
  };

  if (!isLeave) {
    // 加班审批规则
    if (position === '仓管员') {
      return { levels: 1, level1Approvers: ['仓储工班长'], level2Approvers: [], level3Approvers: [] };
    }
    if (position === '仓储工班长') {
      return { levels: 1, level1Approvers: ['副经理', '经理助理'], level2Approvers: ['经理'], level3Approvers: [] };
    }
    // 职能技术岗 加班
    if (['仓储工作岗', '安全工作岗', '综合事务岗', '物资工作岗', '招标采购岗', '合同工作岗', '其他职能技术岗'].includes(position)) {
      return { levels: 1, level1Approvers: ['经理', '副经理', '经理助理'], level2Approvers: [], level3Approvers: [] };
    }
    // 管理岗 加班
    if (position === '副经理' || position === '经理助理') {
      return { levels: 1, level1Approvers: ['经理'], level2Approvers: [], level3Approvers: [] };
    }
    return defaultRule;
  }

  // 调休审批规则
  const leaveDays = leaveHours / 8; // 8小时为1天

  if (position === '仓管员') {
    if (leaveDays <= 1) {
      // ≤1天: 一级审批，选仓储工班长
      return { levels: 1, level1Approvers: ['仓储工班长'], level2Approvers: [], level3Approvers: [] };
    } else if (leaveDays <= 3) {
      // 1-3天: 二级审批，仓储工班长(一级) → 副经理/经理助理(二级)
      return { levels: 2, level1Approvers: ['仓储工班长'], level2Approvers: ['副经理', '经理助理'], level3Approvers: [] };
    } else {
      // >3天: 三级审批，仓储工班长(一级) → 副经理/经理助理(二级) → 经理(三级)
      return { levels: 3, level1Approvers: ['仓储工班长'], level2Approvers: ['副经理', '经理助理'], level3Approvers: ['经理'] };
    }
  }

  if (position === '仓储工班长') {
    if (leaveDays <= 1) {
      // ≤1天: 一级审批，选经理/副经理/经理助理
      return { levels: 1, level1Approvers: ['经理', '副经理', '经理助理'], level2Approvers: [], level3Approvers: [] };
    } else {
      // >1天: 二级审批，副经理/经理助理(一级) → 经理(二级)
      return { levels: 2, level1Approvers: ['副经理', '经理助理'], level2Approvers: ['经理'], level3Approvers: [] };
    }
  }

  // 职能技术岗
  if (['仓储工作岗', '安全工作岗', '综合事务岗', '物资工作岗', '招标采购岗', '合同工作岗', '其他职能技术岗'].includes(position)) {
    if (leaveDays <= 1) {
      // ≤1天: 一级审批，选经理/副经理/经理助理
      return { levels: 1, level1Approvers: ['经理', '副经理', '经理助理'], level2Approvers: [], level3Approvers: [] };
    } else {
      // >1天: 二级审批，副经理/经理助理(一级) → 经理(二级)
      return { levels: 2, level1Approvers: ['副经理', '经理助理'], level2Approvers: ['经理'], level3Approvers: [] };
    }
  }

  // 副经理、经理助理 调休
  if (position === '副经理' || position === '经理助理') {
    return { levels: 1, level1Approvers: ['经理'], level2Approvers: [], level3Approvers: [] };
  }

  return defaultRule;
}

// ===== JWT Token 工具 (Edge runtime compatible, no external deps) =====

function base64UrlEncode(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str += new Array(5 - (str.length % 4)).join('=');
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeJwtPart(obj: Record<string, any>): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

export async function createToken(user: AuthUser): Promise<string> {
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const expDays = parseInt(JWT_EXPIRES_IN.replace('d', ''), 10) || 7;
  const payload = encodeJwtPart({
    ...user,
    iat: now,
    exp: now + expDays * 86400,
  });
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(signature)}`;
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signatureB64) as unknown as BufferSource,
      new TextEncoder().encode(data)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

/**
 * 判断用户是否可以审批指定岗位的记录（兼容旧逻辑）
 */
export function canApprove(approverPosition: string, approverRole: string, applicantPosition: string): boolean {
  // 管理员可以审批所有
  if (approverRole === 'admin') return true;
  // 管理岗可以审批职能技术岗和生产岗
  if (approverRole === 'management') {
    const mgtPositions = POSITION_OPTIONS.management;
    if (mgtPositions.includes(approverPosition)) return false; // 管理岗之间不互相审批
    return true;
  }
  // 仓储工班长可以审批仓管员
  if (approverPosition === '仓储工班长' && applicantPosition === '仓管员') return true;
  return false;
}

/**
 * 获取某个岗位可以作为审批人的级别信息（兼容旧逻辑）
 */
export function getApproverPositions(position: string, role: string): { canLevel1: boolean; canLevel2: boolean } {
  if (role === 'admin') return { canLevel1: true, canLevel2: true };
  const mgtPositions = POSITION_OPTIONS.management;
  if (mgtPositions.includes(position)) return { canLevel1: true, canLevel2: position === '经理' || position === '副经理' };
  if (position === '仓储工班长') return { canLevel1: true, canLevel2: false };
  return { canLevel1: false, canLevel2: false };
}

/**
 * 判断用户是否可以审批指定级别
 */
export function canApproveAtLevel(approverPosition: string, levelApprovers: string[]): boolean {
  return levelApprovers.includes(approverPosition);
}
