'use client';

import { Pencil, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Permissions={sell:boolean;manage_products:boolean;view_reports:boolean;manage_customers:boolean};
type Employee={id:number;username:string;display_name:string;phone?:string;email?:string;role:'admin'|'cashier';permissions:Permissions;is_active:boolean;last_login_at?:string};
const defaults:Permissions={sell:true,manage_products:false,view_reports:false,manage_customers:true};
const blank={username:'',displayName:'',phone:'',email:'',password:'',role:'cashier' as 'admin'|'cashier',permissions:defaults,isActive:true};
const permissionLabels:[keyof Permissions,string][]=[['sell','ขายสินค้า'],['manage_products','จัดการสินค้าและสต๊อก'],['view_reports','ดูรายงานยอดขาย'],['manage_customers','จัดการสมาชิก']];

export default function EmployeePanel(){
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [form,setForm]=useState(blank);
  const [editing,setEditing]=useState<number|null>(null);
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState('');
  const load=async()=>{const response=await fetch('/api/employees',{cache:'no-store'});const data=await response.json();if(response.ok)setEmployees(data.employees||[])};
  useEffect(()=>{load()},[]);
  const openNew=()=>{setEditing(null);setForm(blank);setOpen(true)};
  const openEdit=(employee:Employee)=>{setEditing(employee.id);setForm({username:employee.username,displayName:employee.display_name,phone:employee.phone||'',email:employee.email||'',password:'',role:employee.role,permissions:{...defaults,...employee.permissions},isActive:employee.is_active});setOpen(true)};
  const save=async()=>{const response=await fetch(editing?`/api/employees/${editing}`:'/api/employees',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await response.json();if(!response.ok)return setMessage(data.error);setOpen(false);setMessage('✓ บันทึกข้อมูลพนักงานแล้ว');await load()};
  return <div className="employeePanel"><div className="manageHead"><h2><ShieldCheck/>พนักงานและสิทธิ์</h2><button className="primary" onClick={openNew}><UserPlus/>เพิ่มพนักงาน</button></div>{message&&<p className={message.startsWith('✓')?'success':'notice'}>{message}</p>}{employees.map(employee=><div className={`employeeRow ${employee.is_active?'':'inactive'}`} key={employee.id}><span><b>{employee.display_name}</b><small>@{employee.username} • {employee.role==='admin'?'Admin':'พนักงานขาย'}</small><small>{employee.is_active?'ใช้งานได้':'ปิดใช้งาน'}{employee.last_login_at?` • ล่าสุด ${new Date(employee.last_login_at).toLocaleString('th-TH')}`:''}</small></span><button onClick={()=>openEdit(employee)}><Pencil/></button></div>)}{open&&<div className="overlay"><div className="modal"><div className="modalHead"><b>{editing?'แก้ไขพนักงาน':'เพิ่มพนักงาน'}</b><button onClick={()=>setOpen(false)}><X/></button></div><div className="formGrid"><label><span>ชื่อพนักงาน</span><input value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})}/></label><label><span>ชื่อผู้ใช้</span><input disabled={Boolean(editing)} value={form.username} onChange={event=>setForm({...form,username:event.target.value})}/></label><label><span>เบอร์โทร</span><input inputMode="tel" value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/></label><label><span>อีเมล</span><input type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label><span>{editing?'รหัสผ่านใหม่ (เว้นว่างได้)':'รหัสผ่าน'}</span><input type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label><label><span>ระดับสิทธิ์</span><select value={form.role} onChange={event=>setForm({...form,role:event.target.value as 'admin'|'cashier'})}><option value="cashier">พนักงานขาย</option><option value="admin">Admin — ทุกสิทธิ์</option></select></label></div>{form.role==='cashier'&&<div className="permissionGrid">{permissionLabels.map(([key,label])=><label key={key}><input type="checkbox" checked={form.permissions[key]} onChange={event=>setForm({...form,permissions:{...form.permissions,[key]:event.target.checked}})}/><span>{label}</span></label>)}</div>}{editing&&<label className="activeSwitch"><input type="checkbox" checked={form.isActive} onChange={event=>setForm({...form,isActive:event.target.checked})}/><span>อนุญาตให้เข้าใช้งาน</span></label>}<button className="save" onClick={save}>บันทึกพนักงาน</button></div></div>}</div>;
}
