'use client';

import { Check, Palette } from 'lucide-react';
import { useState } from 'react';

const presets = [
  ['#111827','มิดไนท์'], ['#155E75','น้ำเงินทะเล'], ['#166534','เขียว'],
  ['#5B21B6','ม่วง'], ['#9A3412','ส้มอิฐ'], ['#9F1239','ชมพูกุหลาบ'],
];

export default function ThemePanel({ color, onChange }:{ color:string; onChange:(color:string)=>void }) {
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/settings/theme', {
        method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ color }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || 'บันทึกสีธีมไม่สำเร็จ');
      onChange(data.color);
      setMessage('✓ บันทึกสีธีมแล้ว');
    } catch {
      setMessage('เชื่อมต่อระบบเพื่อบันทึกสีธีมไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  return <div className="themePanel">
    <h2><Palette/> สีธีมร้าน</h2>
    <p>เลือกสีหลักที่ใช้กับปุ่ม เมนู และส่วนสำคัญของระบบ</p>
    <div className="themeSwatches">
      {presets.map(([value,label]) => <button
        key={value} type="button" title={label} aria-label={`เลือกธีม${label}`}
        className={color.toUpperCase() === value ? 'selected' : ''}
        style={{ backgroundColor:value }} onClick={() => onChange(value)}
      >{color.toUpperCase() === value && <Check/>}</button>)}
      <label className="customColor" title="เลือกสีอื่น">
        <input type="color" value={color} onChange={(event) => onChange(event.target.value.toUpperCase())}/>
        <span>สีอื่น</span>
      </label>
    </div>
    <button className="save" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึกสีธีม'}</button>
    {message && <p className={message.startsWith('✓') ? 'success' : 'notice'}>{message}</p>}
  </div>;
}
