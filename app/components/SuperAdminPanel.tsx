'use client';

import { Building2, CreditCard, RefreshCw, Save, ShieldCheck, Store, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type Tenant={
  id:number;account_code:string;store_name:string;owner_name?:string;phone?:string;email?:string;
  status:'active'|'suspended'|'closed';plan:string;created_at:string;
  users:number;products:number;customers:number;branches:number;bills:number;revenue:number|string;
  plan_code?:string;billing_cycle?:string;subscription_status?:string;expires_at?:string;pending_payments:number;
};
type Payment={
  id:number;tenant_id:number;store_name:string;account_code:string;plan_code:string;billing_cycle:string;
  amount:number|string;payment_method:string;status:string;payment_reference?:string;created_at:string;
};
type Billing={promptpayTarget:string;bankName:string;bankAccountName:string;bankAccountNo:string;contactText:string};

const money=(v:number|string)=>Number(v||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const date=(v?:string)=>v?new Date(v).toLocaleDateString('th-TH',{dateStyle:'medium'}):'-';

export default function SuperAdminPanel({onLogout}:{onLogout:()=>void}) {
  const [tenants,setTenants]=useState<Tenant[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [billing,setBilling]=useState<Billing>({promptpayTarget:'',bankName:'',bankAccountName:'',bankAccountNo:'',contactText:''});
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);
    try{
      const [tenantResponse,paymentResponse,billingResponse]=await Promise.all([
        fetch('/api/platform/tenants',{cache:'no-store'}),
        fetch('/api/platform/payments',{cache:'no-store'}),
        fetch('/api/platform/billing',{cache:'no-store'})
      ]);
      const tenantData=await tenantResponse.json(),paymentData=await paymentResponse.json(),billingData=await billingResponse.json();
      if(!tenantResponse.ok)throw new Error(tenantData.error);
      setTenants(tenantData.tenants||[]);
      if(paymentResponse.ok)setPayments(paymentData.payments||[]);
      if(billingResponse.ok)setBilling({
        promptpayTarget:billingData.billing?.promptpay_target||'',
        bankName:billingData.billing?.bank_name||'',
        bankAccountName:billingData.billing?.bank_account_name||'',
        bankAccountNo:billingData.billing?.bank_account_no||'',
        contactText:billingData.billing?.contact_text||''
      });
    }catch(error){setMessage(error instanceof Error?error.message:'โหลดข้อมูลไม่สำเร็จ')}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const update=async(tenant:Tenant,status:Tenant['status'])=>{
    const response=await fetch('/api/platform/tenants/'+tenant.id,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,plan:tenant.plan_code||tenant.plan})
    });
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setMessage('✓ อัปเดตสถานะร้านค้าแล้ว');await load();
  };

  const paymentAction=async(payment:Payment,action:'approve'|'reject')=>{
    const response=await fetch('/api/platform/payments/'+payment.id,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})
    });
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setMessage(action==='approve'?'✓ อนุมัติการชำระเงินและเปิดแพ็กเกจแล้ว':'✓ ปฏิเสธรายการชำระเงินแล้ว');
    await load();
  };

  const saveBilling=async()=>{
    const response=await fetch('/api/platform/billing',{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(billing)
    });
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setMessage('✓ บันทึกช่องทางรับชำระเงินแล้ว');
  };

  const active=tenants.filter(t=>t.status==='active').length;
  const users=tenants.reduce((sum,t)=>sum+Number(t.users||0),0);
  const pending=payments.filter(p=>p.status==='pending');

  return <main className="shell">
    <header><div><small>MARKET POS PLATFORM</small><h1>Super Admin</h1></div><div className="headerActions"><button className="avatar" onClick={load}><RefreshCw size={18}/></button><button className="avatar secondary" onClick={onLogout}>ออก</button></div></header>
    {message&&<p className={message.startsWith('✓')?'success':'notice'}>{message}</p>}
    <section>
      <div className="stats">
        <article><b>{tenants.length}</b><span>Account ร้านค้าทั้งหมด</span></article>
        <article><b>{active}</b><span>ร้านที่ใช้งาน</span></article>
        <article><b>{users}</b><span>ผู้ใช้งานทั้งหมด</span></article>
        <article><b>{pending.length}</b><span>รอตรวจสอบชำระเงิน</span></article>
      </div>

      <div className="billingAdmin">
        <h2><CreditCard/>ช่องทางรับค่าบริการ</h2>
        <div className="formGrid">
          <label><span>PromptPay</span><input value={billing.promptpayTarget} onChange={e=>setBilling({...billing,promptpayTarget:e.target.value})}/></label>
          <label><span>ธนาคาร</span><input value={billing.bankName} onChange={e=>setBilling({...billing,bankName:e.target.value})}/></label>
          <label><span>ชื่อบัญชี</span><input value={billing.bankAccountName} onChange={e=>setBilling({...billing,bankAccountName:e.target.value})}/></label>
          <label><span>เลขบัญชี</span><input value={billing.bankAccountNo} onChange={e=>setBilling({...billing,bankAccountNo:e.target.value})}/></label>
        </div>
        <label><span>ข้อความติดต่อ/คำแนะนำ</span><input className="bigInput" value={billing.contactText} onChange={e=>setBilling({...billing,contactText:e.target.value})}/></label>
        <button className="save" onClick={saveBilling}><Save/>บันทึกช่องทางชำระเงิน</button>
      </div>

      <div className="manageHead"><h2><CreditCard/>รายการรอตรวจสอบ</h2></div>
      {pending.length?pending.map(payment=><div className="paymentAdminRow" key={payment.id}>
        <span><b>{payment.store_name} • {payment.plan_code.toUpperCase()}</b><small>{payment.account_code} • {payment.billing_cycle==='yearly'?'รายปี':'รายเดือน'} • {date(payment.created_at)}</small><strong>฿{money(payment.amount)}</strong></span>
        <div className="paymentAdminActions"><button className="approveButton" onClick={()=>paymentAction(payment,'approve')}>อนุมัติ</button><button className="rejectButton" onClick={()=>paymentAction(payment,'reject')}>ปฏิเสธ</button></div>
      </div>):<p className="empty">ไม่มีรายการรอตรวจสอบ</p>}

      <div className="manageHead"><h2><ShieldCheck/>จัดการ Account ร้านค้า</h2></div>
      {loading?<p>กำลังโหลด...</p>:tenants.map(tenant=><article className="employeeRow" key={tenant.id}>
        <span>
          <b><Store size={16}/> {tenant.store_name}</b>
          <small>{tenant.account_code} • {tenant.owner_name||'-'} • {(tenant.plan_code||tenant.plan||'-').toUpperCase()}</small>
          <small><Users size={14}/> {tenant.users} ผู้ใช้ • <Building2 size={14}/> {tenant.products} สินค้า • {tenant.branches} สาขา • {tenant.customers} สมาชิก</small>
          <small>Subscription: {tenant.subscription_status||'-'} • หมดอายุ {date(tenant.expires_at)}{tenant.pending_payments?' • รอชำระ '+tenant.pending_payments+' รายการ':''}</small>
        </span>
        <div className="tenantActions">
          {tenant.status!=='active'&&<button onClick={()=>update(tenant,'active')}>เปิดใช้งาน</button>}
          {tenant.status==='active'&&<button onClick={()=>update(tenant,'suspended')}>ระงับ</button>}
          {tenant.status!=='closed'&&<button onClick={()=>update(tenant,'closed')}>ปิด Account</button>}
        </div>
      </article>)}
    </section>
  </main>;
}
