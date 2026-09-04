'use client';

import { LockKeyhole, Store } from 'lucide-react';
import { useState } from 'react';

export default function AuthScreen({setupRequired,onAuthenticated}:{setupRequired:boolean;onAuthenticated:()=>void}) {
  const [form,setForm]=useState({username:'',displayName:'',password:''});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const submit=async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch(setupRequired?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      onAuthenticated();
    }catch(error){setError(error instanceof Error?error.message:'ดำเนินการไม่สำเร็จ')}finally{setLoading(false)}
  };
  return <main className="authShell"><div className="authCard"><div className="authLogo"><Store/></div><small>MARKET POS</small><h1>{setupRequired?'ตั้งค่าเจ้าของร้าน':'เข้าสู่ระบบ'}</h1><p>{setupRequired?'สร้างบัญชี Admin คนแรกสำหรับจัดการร้านและพนักงาน':'กรอกบัญชีพนักงานเพื่อเริ่มใช้งาน'}</p>{setupRequired&&<label><span>ชื่อที่แสดง</span><input value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})} placeholder="เช่น เจ้าของร้าน"/></label>}<label><span>ชื่อผู้ใช้</span><input autoCapitalize="none" value={form.username} onChange={event=>setForm({...form,username:event.target.value})} placeholder="ภาษาอังกฤษอย่างน้อย 3 ตัว"/></label><label><span>รหัสผ่าน</span><input type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder="อย่างน้อย 8 ตัว" onKeyDown={event=>event.key==='Enter'&&submit()}/></label>{error&&<p className="notice">{error}</p>}<button className="save" disabled={loading} onClick={submit}><LockKeyhole/>{loading?'กำลังตรวจสอบ...':setupRequired?'สร้างบัญชี Admin':'เข้าสู่ระบบ'}</button></div></main>;
}
