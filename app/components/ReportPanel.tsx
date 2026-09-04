'use client';

import { CalendarDays, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Report={summary:{bills:number;revenue:number;discount:number;items:number;gross_profit:number;averageBill:number};daily:Array<{date:string;bills:number;revenue:number}>;topProducts:Array<{product_name:string;quantity:number;revenue:number}>;payments:Array<{payment_method:string;bills:number;revenue:number}>;employees:Array<{employee_name:string;bills:number;revenue:number}>};
const money=(value:number)=>Number(value||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
const paymentLabel:Record<string,string>={cash:'เงินสด',promptpay:'PromptPay',transfer:'โอนเงิน'};

export default function ReportPanel(){
  const [mode,setMode]=useState<'day'|'range'|'month'>('day');
  const [date,setDate]=useState(today());
  const [start,setStart]=useState(today());
  const [end,setEnd]=useState(today());
  const [month,setMonth]=useState(today().slice(0,7));
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const query=useMemo(()=>mode==='day'?`mode=day&date=${date}`:mode==='month'?`mode=month&month=${month}`:`mode=range&start=${start}&end=${end}`,[mode,date,start,end,month]);
  const load=async()=>{setLoading(true);setError('');try{const response=await fetch(`/api/reports?${query}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error);setReport(data)}catch(error){setError(error instanceof Error?error.message:'โหลดรายงานไม่สำเร็จ')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const maxDaily=Math.max(1,...(report?.daily.map(item=>Number(item.revenue))||[1]));
  return <section><div className="reportModes">{([['day','รายวัน'],['range','ช่วงวัน'],['month','รายเดือน']] as const).map(([value,label])=><button key={value} className={mode===value?'active':''} onClick={()=>setMode(value)}>{label}</button>)}</div><div className="dateFilters">{mode==='day'&&<label><span>วันที่</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>}{mode==='range'&&<><label><span>ตั้งแต่</span><input type="date" value={start} onChange={event=>setStart(event.target.value)}/></label><label><span>ถึง</span><input type="date" value={end} onChange={event=>setEnd(event.target.value)}/></label></>}{mode==='month'&&<label><span>เดือน</span><input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label>}<button className="primary" onClick={load}><CalendarDays/>ดูรายงาน</button></div>{error&&<p className="notice">{error}</p>}{loading?<p>กำลังโหลดรายงาน...</p>:report&&<><div className="reportStats"><article><small>ยอดขาย</small><b>฿{money(report.summary.revenue)}</b></article><article><small>จำนวนบิล</small><b>{report.summary.bills}</b></article><article><small>กำไรขั้นต้น</small><b>฿{money(report.summary.gross_profit)}</b></article><article><small>เฉลี่ยต่อบิล</small><b>฿{money(report.summary.averageBill)}</b></article></div><div className="reportSection"><h2><TrendingUp/>ยอดขายรายวัน</h2>{report.daily.length?report.daily.map(item=><div className="barRow" key={item.date}><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</span><div><i style={{width:`${Math.max(3,Number(item.revenue)/maxDaily*100)}%`}}/></div><b>฿{money(item.revenue)}</b></div>):<p className="empty">ไม่มียอดขายในช่วงที่เลือก</p>}</div><div className="reportColumns"><div className="reportSection"><h2>สินค้าขายดี</h2>{report.topProducts.map((item,index)=><div className="rankRow" key={item.product_name}><span><i>{index+1}</i>{item.product_name}</span><b>{item.quantity} ชิ้น • ฿{money(item.revenue)}</b></div>)}</div><div className="reportSection"><h2>ช่องทางชำระเงิน</h2>{report.payments.map(item=><div className="rankRow" key={item.payment_method}><span>{paymentLabel[item.payment_method]||item.payment_method}</span><b>{item.bills} บิล • ฿{money(item.revenue)}</b></div>)}</div></div><div className="reportSection"><h2>ยอดขายตามพนักงาน</h2>{report.employees.map(item=><div className="rankRow" key={item.employee_name}><span>{item.employee_name}</span><b>{item.bills} บิล • ฿{money(item.revenue)}</b></div>)}</div></>}</section>;
}
