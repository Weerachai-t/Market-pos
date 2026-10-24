'use client';

import Image from 'next/image';
import { Building2, CheckCircle2, CreditCard, Plus, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Plan={code:string;name:string;monthly_price:number|string;yearly_price:number|string;user_limit:number;product_limit:number;branch_limit:number;features:Record<string,boolean>};
type Subscription={plan_code:string;plan_name:string;billing_cycle:string;effective_status:string;starts_at:string;expires_at:string;user_limit:number;product_limit:number;branch_limit:number;users:number;products:number;branches:number};
type Payment={id:number;plan_code:string;billing_cycle:string;amount:number|string;payment_method:string;status:string;payment_reference?:string;created_at:string;approved_at?:string};
type Branch={id:number;branch_code:string;name:string;phone?:string;address?:string;is_active:boolean};
type Billing={promptpay_target?:string;bank_name?:string;bank_account_name?:string;bank_account_no?:string;contact_text?:string};

const money=(v:number|string)=>Number(v||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const date=(v?:string)=>v?new Date(v).toLocaleDateString('th-TH',{dateStyle:'medium'}):'-';

export default function SubscriptionPanel(){
  const [plans,setPlans]=useState<Plan[]>([]);
  const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [billing,setBilling]=useState<Billing>({});
  const [cycle,setCycle]=useState<'monthly'|'yearly'>('monthly');
  const [selected,setSelected]=useState<Plan|null>(null);
  const [qr,setQr]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const [branchForm,setBranchForm]=useState({branchCode:'',name:'',phone:'',address:''});

  const load=async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/subscription',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setPlans(data.plans||[]);setSubscription(data.subscription||null);setPayments(data.payments||[]);
      setBranches(data.branches||[]);setBilling(data.billing||{});
    }catch(error){setMessage(error instanceof Error?error.message:'โหลดแพ็กเกจไม่สำเร็จ')}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const amount=useMemo(()=>selected?Number(cycle==='yearly'?selected.yearly_price:selected.monthly_price):0,[selected,cycle]);

  const showQr=async(plan:Plan)=>{
    setSelected(plan);setMessage('');setQr('');
    if(!billing.promptpay_target)return setMessage('ยังไม่ได้ตั้งค่า PromptPay สำหรับรับค่าบริการ กรุณาใช้ข้อมูลบัญชีธนาคารหรือติดต่อผู้ดูแลระบบ');
    const price=Number(cycle==='yearly'?plan.yearly_price:plan.monthly_price);
    const response=await fetch('/api/promptpay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:billing.promptpay_target,amount:price})});
    const data=await response.json();
    if(!response.ok)return setMessage(data.error||'สร้าง QR ไม่สำเร็จ');
    setQr(data.qr);
  };

  const notifyPayment=async()=>{
    if(!selected)return;
    const response=await fetch('/api/subscription/payment',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({planCode:selected.code,billingCycle:cycle,paymentMethod:billing.promptpay_target?'promptpay':'bank_transfer'})
    });
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setQr('');setSelected(null);setMessage('✓ ส่งคำขอตรวจสอบการชำระเงินแล้ว รอ Super Admin อนุมัติ');
    await load();
  };

  const addBranch=async()=>{
    const response=await fetch('/api/branches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(branchForm)});
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setBranchForm({branchCode:'',name:'',phone:'',address:''});setMessage('✓ เพิ่มสาขาแล้ว');await load();
  };

  if(loading)return <div className="subscriptionPanel"><p>กำลังโหลดข้อมูลสมาชิก...</p></div>;

  return <div className="subscriptionPanel">
    <div className="subscriptionHead"><div><small>SUBSCRIPTION</small><h2><CreditCard/>แพ็กเกจสมาชิก</h2></div><button onClick={load}><RefreshCw/></button></div>
    {message&&<p className={message.startsWith('✓')?'success':'notice'}>{message}</p>}
    {subscription&&<div className="subscriptionCurrent">
      <div><small>แพ็กเกจปัจจุบัน</small><strong>{subscription.plan_name}</strong><span className={subscription.effective_status==='expired'?'expiredBadge':'activeBadge'}>{subscription.effective_status}</span></div>
      <div><small>วันหมดอายุ</small><b>{date(subscription.expires_at)}</b></div>
      <div className="usageGrid">
        <article><span>ผู้ใช้</span><b>{subscription.users}/{subscription.user_limit}</b></article>
        <article><span>สินค้า</span><b>{subscription.products}/{subscription.product_limit}</b></article>
        <article><span>สาขา</span><b>{subscription.branches}/{subscription.branch_limit}</b></article>
      </div>
    </div>}

    <div className="billingToggle"><button className={cycle==='monthly'?'active':''} onClick={()=>setCycle('monthly')}>รายเดือน</button><button className={cycle==='yearly'?'active':''} onClick={()=>setCycle('yearly')}>รายปี</button></div>
    <div className="planGrid">{plans.map(plan=><article className={subscription?.plan_code===plan.code?'planCard currentPlan':'planCard'} key={plan.code}>
      <div><b>{plan.name}</b>{subscription?.plan_code===plan.code&&<small>แพ็กเกจปัจจุบัน</small>}</div>
      <strong>฿{money(cycle==='yearly'?plan.yearly_price:plan.monthly_price)}<small>/{cycle==='yearly'?'ปี':'เดือน'}</small></strong>
      <span>ผู้ใช้สูงสุด {plan.user_limit}</span><span>สินค้า {plan.product_limit.toLocaleString()} รายการ</span><span>สาขา {plan.branch_limit}</span>
      <button className="primary" onClick={()=>showQr(plan)}>เลือกแพ็กเกจ</button>
    </article>)}</div>

    {selected&&<div className="paymentBox"><div className="modalHead"><b>ชำระค่าบริการ {selected.name}</b><button onClick={()=>{setSelected(null);setQr('')}}><XCircle/></button></div>
      <strong className="paymentAmount">฿{money(amount)}</strong>
      {qr&&<div className="qrWrap"><Image src={qr} alt="Subscription PromptPay QR" width={300} height={300} unoptimized/><small>สแกน PromptPay แล้วกด “แจ้งชำระแล้ว”</small></div>}
      {!qr&&<div className="bankBox"><b>{billing.bank_name||'โอนผ่านบัญชีธนาคาร'}</b><span>{billing.bank_account_name||''}</span><strong>{billing.bank_account_no||''}</strong><small>{billing.contact_text||'หลังชำระเงิน กรุณาแจ้งรายการเพื่อรอตรวจสอบ'}</small></div>}
      <button className="save" onClick={notifyPayment}><CheckCircle2/>แจ้งชำระแล้ว</button>
    </div>}

    <div className="subscriptionSection"><h2><Building2/>จัดการสาขา</h2>
      <div className="branchList">{branches.map(item=><div className="branchRow" key={item.id}><span><b>{item.name}</b><small>{item.branch_code}{item.phone?' • '+item.phone:''}</small></span><small>{item.is_active?'ใช้งาน':'ปิดใช้งาน'}</small></div>)}</div>
      <div className="formGrid">
        <label><span>รหัสสาขา</span><input value={branchForm.branchCode} onChange={e=>setBranchForm({...branchForm,branchCode:e.target.value})} placeholder="เช่น BKK01"/></label>
        <label><span>ชื่อสาขา</span><input value={branchForm.name} onChange={e=>setBranchForm({...branchForm,name:e.target.value})}/></label>
        <label><span>เบอร์โทร</span><input value={branchForm.phone} onChange={e=>setBranchForm({...branchForm,phone:e.target.value})}/></label>
        <label><span>ที่อยู่</span><input value={branchForm.address} onChange={e=>setBranchForm({...branchForm,address:e.target.value})}/></label>
      </div><button className="primary branchAdd" onClick={addBranch}><Plus/>เพิ่มสาขา</button>
    </div>

    <div className="subscriptionSection"><h2>ประวัติการชำระ</h2>
      {payments.length?payments.map(item=><div className="historyRow" key={item.id}><span><b>{item.plan_code.toUpperCase()} • {item.billing_cycle==='yearly'?'รายปี':'รายเดือน'}</b><small>{date(item.created_at)} • {item.status}</small></span><strong>฿{money(item.amount)}</strong></div>):<p className="empty">ยังไม่มีรายการชำระเงิน</p>}
    </div>
  </div>;
}
