'use client';

import { Building2, RefreshCw, ShieldCheck, Store, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type Tenant={
  id:number;account_code:string;store_name:string;owner_name?:string;phone?:string;email?:string;
  status:'active'|'suspended'|'closed';plan:string;created_at:string;
  users:number;products:number;customers:number;bills:number;revenue:number|string;
};

export default function SuperAdminPanel({onLogout}:{onLogout:()=>void}) {
  const [tenants,setTenants]=useState<Tenant[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/platform/tenants',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setTenants(data.tenants||[]);
    }catch(error){setMessage(error instanceof Error?error.message:'โหลดข้อมูลไม่สำเร็จ')}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const update=async(tenant:Tenant,status:Tenant['status'])=>{
    const response=await fetch(`/api/platform/tenants/${tenant.id}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,plan:tenant.plan})
    });
    const data=await response.json();
    if(!response.ok)return setMessage(data.error);
    setMessage('✓ อัปเดตสถานะร้านค้าแล้ว');
    await load();
  };

  const active=tenants.filter(t=>t.status==='active').length;
  const users=tenants.reduce((sum,t)=>sum+Number(t.users||0),0);

  return <main className="shell">
    <header><div><small>MARKET POS PLATFORM</small><h1>Super Admin</h1></div><div className="headerActions"><button className="avatar" onClick={load}><RefreshCw size={18}/></button><button className="avatar secondary" onClick={onLogout}>ออก</button></div></header>
    {message&&<p className={message.startsWith('✓')?'success':'notice'}>{message}</p>}
    <section>
      <div className="stats">
        <article><b>{tenants.length}</b><span>Account ร้านค้าทั้งหมด</span></article>
        <article><b>{active}</b><span>ร้านที่ใช้งาน</span></article>
        <article><b>{users}</b><span>ผู้ใช้งานทั้งหมด</span></article>
      </div>
      <div className="manageHead"><h2><ShieldCheck/>จัดการ Account ร้านค้า</h2></div>
      {loading?<p>กำลังโหลด...</p>:tenants.map(tenant=><article className="employeeRow" key={tenant.id}>
        <span>
          <b><Store size={16}/> {tenant.store_name}</b>
          <small>{tenant.account_code} • {tenant.owner_name||'-'} • {tenant.plan}</small>
          <small><Users size={14}/> {tenant.users} ผู้ใช้ • <Building2 size={14}/> {tenant.products} สินค้า • {tenant.customers} สมาชิก • {tenant.bills} บิล</small>
          <small>สถานะ: {tenant.status}</small>
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
