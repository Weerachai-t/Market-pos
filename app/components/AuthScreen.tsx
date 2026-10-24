'use client';

import { LockKeyhole, Store, UserPlus } from 'lucide-react';
import { useState } from 'react';

export default function AuthScreen({setupRequired,onAuthenticated}:{setupRequired:boolean;onAuthenticated:()=>void}) {
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [form,setForm]=useState({username:'',displayName:'',password:'',storeName:'',ownerName:'',phone:'',email:''});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const submit=async()=>{
    setLoading(true);setError('');
    try{
      const endpoint=mode==='register'?'/api/auth/register':(setupRequired?'/api/auth/setup':'/api/auth/login');
      const payload=mode==='register'?{
        username:form.username,password:form.password,storeName:form.storeName,
        ownerName:form.ownerName,phone:form.phone,email:form.email,
      }:{username:form.username,displayName:form.displayName,password:form.password};
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      onAuthenticated();
    }catch(error){setError(error instanceof Error?error.message:'ดำเนินการไม่สำเร็จ')}finally{setLoading(false)}
  };

  return <main className="authShell"><div className="authCard">
    <div className="authLogo"><Store/></div><small>MARKET POS</small>
    <h1>{mode==='register'?'สมัครร้านค้าใหม่':setupRequired?'ตั้งค่าเจ้าของร้าน':'เข้าสู่ระบบ'}</h1>
    <p>{mode==='register'?'เปิด Account ร้านค้าและสร้าง Admin ของร้านคุณ':'เข้าสู่ระบบด้วยบัญชีของร้านค้า'}</p>

    {mode==='register'&&<>
      <label><span>ชื่อร้านค้า</span><input value={form.storeName} onChange={e=>setForm({...form,storeName:e.target.value})} placeholder="เช่น ร้านสมใจมาร์ท"/></label>
      <label><span>ชื่อเจ้าของร้าน</span><input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} placeholder="ชื่อผู้ดูแล Account"/></label>
      <label><span>เบอร์โทร</span><input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
      <label><span>อีเมล</span><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    </>}

    {setupRequired&&mode==='login'&&<label><span>ชื่อที่แสดง</span><input value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})} placeholder="เช่น เจ้าของร้าน"/></label>}
    <label><span>ชื่อผู้ใช้</span><input autoCapitalize="none" value={form.username} onChange={event=>setForm({...form,username:event.target.value})} placeholder="ภาษาอังกฤษอย่างน้อย 3 ตัว"/></label>
    <label><span>รหัสผ่าน</span><input type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder="อย่างน้อย 8 ตัว" onKeyDown={event=>event.key==='Enter'&&submit()}/></label>
    {error&&<p className="notice">{error}</p>}
    <button className="save" disabled={loading} onClick={submit}>{mode==='register'?<UserPlus/>:<LockKeyhole/>}{loading?'กำลังดำเนินการ...':mode==='register'?'สร้าง Account ร้านค้า':'เข้าสู่ระบบ'}</button>
    {!setupRequired&&<button className="authSwitch" onClick={()=>{setError('');setMode(mode==='login'?'register':'login')}}>
      {mode==='login'?'ยังไม่มี Account? สมัครร้านค้า':'มี Account แล้ว? เข้าสู่ระบบ'}
    </button>}
  </div></main>;
}
