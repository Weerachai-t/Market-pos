import { NextResponse } from 'next/server';
import { getCurrentEmployee, hasPermission } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const bangkokToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
const addDays = (value:string,days:number) => {
  const [year,month,day]=value.split('-').map(Number);
  const result=new Date(Date.UTC(year,month-1,day+days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth()+1).padStart(2,'0')}-${String(result.getUTCDate()).padStart(2,'0')}`;
};

function rangeFrom(url:URL) {
  const mode = url.searchParams.get('mode') || 'day';
  let startText:string;
  let endText:string;
  if (mode === 'month') {
    const month = url.searchParams.get('month') || bangkokToday().slice(0,7);
    if (!monthPattern.test(month)) throw new Error('เดือนที่เลือกไม่ถูกต้อง');
    const [year,monthNumber] = month.split('-').map(Number);
    startText = `${month}-01`;
    const next = new Date(Date.UTC(year,monthNumber,1));
    endText = `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}-01`;
  } else if (mode === 'range') {
    startText = url.searchParams.get('start') || bangkokToday();
    const inclusiveEnd = url.searchParams.get('end') || startText;
    if (!datePattern.test(startText) || !datePattern.test(inclusiveEnd)) throw new Error('ช่วงวันที่ไม่ถูกต้อง');
    endText = addDays(inclusiveEnd,1);
  } else {
    startText = url.searchParams.get('date') || bangkokToday();
    if (!datePattern.test(startText)) throw new Error('วันที่ไม่ถูกต้อง');
    endText = addDays(startText,1);
  }
  const start = new Date(`${startText}T00:00:00+07:00`);
  const end = new Date(`${endText}T00:00:00+07:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error('ช่วงวันที่ไม่ถูกต้อง');
  if (end.getTime()-start.getTime() > 366*86400000) throw new Error('เลือกช่วงรายงานได้ไม่เกิน 366 วัน');
  return {mode,start:start.toISOString(),end:end.toISOString(),startText,endText};
}

export async function GET(request:Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!hasPermission(employee,'view_reports')) return NextResponse.json({error:'ไม่มีสิทธิ์ดูรายงาน'}, {status:403});
  try {
    const selected = rangeFrom(new URL(request.url));
    const sql = getDb();
    const [summaryRows,daily,topProducts,payments,employees] = await Promise.all([
      sql`
        WITH filtered_sales AS (
          SELECT id,total,discount FROM sales
           WHERE status='completed' AND sold_at>=${selected.start} AND sold_at<${selected.end}
        )
        SELECT COUNT(*)::int AS bills, COALESCE(SUM(total),0)::float AS revenue,
               COALESCE(SUM(discount),0)::float AS discount,
               COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN filtered_sales f ON f.id=si.sale_id),0)::float AS items,
               COALESCE((SELECT SUM(si.line_total-(si.cost_price*si.quantity)) FROM sale_items si JOIN filtered_sales f ON f.id=si.sale_id),0)::float AS gross_profit
          FROM filtered_sales
      `,
      sql`
        SELECT (sold_at AT TIME ZONE 'Asia/Bangkok')::date::text AS date,
               COUNT(*)::int AS bills, SUM(total)::float AS revenue
          FROM sales WHERE status='completed' AND sold_at>=${selected.start} AND sold_at<${selected.end}
         GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT si.product_name, SUM(si.quantity)::float AS quantity, SUM(si.line_total)::float AS revenue
          FROM sale_items si JOIN sales s ON s.id=si.sale_id
         WHERE s.status='completed' AND s.sold_at>=${selected.start} AND s.sold_at<${selected.end}
         GROUP BY si.product_name ORDER BY revenue DESC LIMIT 10
      `,
      sql`
        SELECT payment_method, COUNT(*)::int AS bills, SUM(total)::float AS revenue
          FROM sales WHERE status='completed' AND sold_at>=${selected.start} AND sold_at<${selected.end}
         GROUP BY payment_method ORDER BY revenue DESC
      `,
      sql`
        SELECT COALESCE(u.display_name,'ไม่ระบุพนักงาน') AS employee_name,
               COUNT(*)::int AS bills, SUM(s.total)::float AS revenue
          FROM sales s LEFT JOIN users u ON u.id=s.cashier_id
         WHERE s.status='completed' AND s.sold_at>=${selected.start} AND s.sold_at<${selected.end}
         GROUP BY u.id,u.display_name ORDER BY revenue DESC
      `,
    ]);
    const summary = summaryRows[0];
    return NextResponse.json({
      range:{mode:selected.mode,start:selected.startText,endExclusive:selected.endText},
      summary:{...summary,averageBill:Number(summary.bills)?Number(summary.revenue)/Number(summary.bills):0},
      daily,topProducts,payments,employees,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'โหลดรายงานไม่สำเร็จ';
    const inputError = message.includes('ไม่ถูกต้อง') || message.includes('ไม่เกิน');
    if (!inputError) console.error(error);
    return NextResponse.json({error:inputError?message:'โหลดรายงานไม่สำเร็จ'}, {status:inputError?400:500});
  }
}
