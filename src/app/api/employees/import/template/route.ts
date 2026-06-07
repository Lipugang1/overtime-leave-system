import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const csv = `username,name,role_category,position,department,module,squad,password
zhangsan,张三,functional_tech,仓储工作岗,物资仓储部,仓储物流模块,,123456
lisi,李四,management,经理,物资仓储部,物资计划模块,,123456
wangwu,王五,production,仓管员,物资仓储部,物资采购模块,东部储运工班,123456

说明:
1. username(工号): 必填，如未填写系统将自动生成
2. name(姓名): 必填
3. role_category(角色分类): 可选，系统根据岗位自动推断。可填: admin/management/functional_tech/production
4. position(岗位): 必填，如: 经理/副经理/经理助理/仓储工作岗/安全工作岗/综合事务岗/物资工作岗/招标采购岗/合同工作岗/其他职能技术岗/仓储工班长/仓管员
5. department(部门): 可选，默认"物资仓储部"
6. module(模块): 可选，如: 仓储物流模块/物资计划模块/物资采购模块/综合模块
7. squad(工班): 生产岗必填，如: 东部储运工班/南部储运工班/西部储运工班
8. password(密码): 可选，默认123456

岗位与角色自动对应规则:
- 经理/副经理/经理助理 → management(管理岗)
- 仓储工班长/仓管员 → production(生产岗)
- 其他岗位 → functional_tech(职能技术岗)`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=employee_import_template.csv',
    },
  });
}
