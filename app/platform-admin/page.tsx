'use client';

import { useEffect, useState } from 'react';
import AuthScreen from '../components/AuthScreen';
import SuperAdminPanel from '../components/SuperAdminPanel';

type Employee={id:number;platform_role?:string};

export default function PlatformAdminPage(){
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [loading,setLoading]=useState(true);

  const refresh=async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/auth/session',{cache:'no-store'});
      const data=await response.json();
      setEmployee(data.employee||null);
    }finally{setLoading(false)}
  };

  useEffect(()=>{refresh()},[]);

  const logout=async()=>{
    await fetch('/api/auth/logout',{method:'POST'});
    setEmployee(null);
  };

  if(loading)return <main className="authShell"><div className="authCard"><p>กำลังตรวจสอบบัญชี...</p></div></main>;
  if(!employee)return <AuthScreen setupRequired={false} onAuthenticated={refresh}/>;
  if(employee.platform_role!=='super_admin')return <main className="authShell"><div className="authCard"><h1>ไม่มีสิทธิ์</h1><p>หน้านี้สำหรับ Super Admin ของแพลตฟอร์มเท่านั้น</p></div></main>;
  return <SuperAdminPanel onLogout={logout}/>;
}
