'use client';
import { useMemo, useState } from 'react';
import { Home, Package, ShoppingCart, BarChart3, Settings, Search, Plus, Minus, Banknote, QrCode, Trash2 } from 'lucide-react';

type Product={id:number;name:string;price:number;stock:number;emoji:string;category:string};
const products:Product[]=[
{id:1,name:'น้ำดื่ม',price:10,stock:48,emoji:'💧',category:'เครื่องดื่ม'},
{id:2,name:'กาแฟเย็น',price:35,stock:24,emoji:'🥤',category:'เครื่องดื่ม'},
{id:3,name:'ชาไทย',price:30,stock:18,emoji:'🧋',category:'เครื่องดื่ม'},
{id:4,name:'ขนมปัง',price:25,stock:16,emoji:'🍞',category:'อาหาร'},
{id:5,name:'ลูกชิ้น',price:40,stock:30,emoji:'🍢',category:'อาหาร'},
{id:6,name:'เสื้อยืด',price:199,stock:8,emoji:'👕',category:'สินค้า'},
];

type Cart=Product&{qty:number};
export default function Page(){
 const [tab,setTab]=useState('ขาย'); const [cart,setCart]=useState<Cart[]>([]); const [query,setQuery]=useState(''); const [paid,setPaid]=useState(false);
 const total=cart.reduce((s,i)=>s+i.price*i.qty,0); const count=cart.reduce((s,i)=>s+i.qty,0);
 const filtered=useMemo(()=>products.filter(p=>p.name.includes(query)),[query]);
 const add=(p:Product)=>{setPaid(false);setCart(c=>{const x=c.find(i=>i.id===p.id);return x?c.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...c,{...p,qty:1}]})};
 const qty=(id:number,d:number)=>setCart(c=>c.map(i=>i.id===id?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0));
 const checkout=(method:string)=>{if(!total)return; setPaid(true); setTimeout(()=>{alert(`รับชำระ ${method} ฿${total.toLocaleString()} สำเร็จ`);setCart([]);setPaid(false)},200)};
 return <main className="shell">
  <header><div><small>MARKET POS</small><h1>{tab==='ขาย'?'ขายสินค้า':tab}</h1></div><div className="avatar">MP</div></header>
  {tab==='หน้าหลัก'&&<section><div className="hero"><span>ยอดขายวันนี้</span><strong>฿3,840</strong><small>28 บิล • กำไรประมาณ ฿1,420</small></div><div className="stats"><article><b>28</b><span>บิลวันนี้</span></article><article><b>67</b><span>สินค้าที่ขาย</span></article></div><h2>ขายดีวันนี้</h2>{products.slice(0,3).map((p,i)=><div className="row" key={p.id}><span>{i+1}. {p.emoji} {p.name}</span><b>{12-i*3} ชิ้น</b></div>)}</section>}
  {tab==='ขาย'&&<section><div className="search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาสินค้า / Barcode"/></div><div className="grid">{filtered.map(p=><button className="product" key={p.id} onClick={()=>add(p)}><span className="emoji">{p.emoji}</span><b>{p.name}</b><small>คงเหลือ {p.stock}</small><strong>฿{p.price}</strong></button>)}</div>{cart.length>0&&<div className="cart"><div className="cartTitle"><b><ShoppingCart size={18}/> ตะกร้า ({count})</b><button onClick={()=>setCart([])}><Trash2 size={17}/></button></div>{cart.map(i=><div className="cartRow" key={i.id}><span>{i.name}<small>฿{i.price}</small></span><div><button onClick={()=>qty(i.id,-1)}><Minus/></button><b>{i.qty}</b><button onClick={()=>qty(i.id,1)}><Plus/></button></div></div>)}<div className="total"><span>ยอดรวม</span><strong>฿{total.toLocaleString()}</strong></div><div className="pay"><button onClick={()=>checkout('เงินสด')}><Banknote/> เงินสด</button><button onClick={()=>checkout('PromptPay')}><QrCode/> QR PromptPay</button></div>{paid&&<p className="success">กำลังบันทึกการขาย...</p>}</div>}</section>}
  {tab==='สินค้า'&&<section><div className="hero mini"><span>สินค้าทั้งหมด</span><strong>{products.length} รายการ</strong><small>สินค้าใกล้หมด 1 รายการ</small></div>{products.map(p=><div className="row" key={p.id}><span>{p.emoji} {p.name}<small>{p.category}</small></span><b>฿{p.price} • {p.stock}</b></div>)}</section>}
  {tab==='รายงาน'&&<section><div className="hero"><span>ยอดขายเดือนนี้</span><strong>฿42,650</strong><small>312 บิล</small></div><h2>สรุป</h2><div className="stats"><article><b>฿13,940</b><span>กำไร</span></article><article><b>846</b><span>ชิ้นที่ขาย</span></article></div></section>}
  {tab==='ตั้งค่า'&&<section><h2>ตั้งค่าร้านค้า</h2>{['ข้อมูลร้านค้า','PromptPay / QR รับเงิน','เครื่องพิมพ์ใบเสร็จ','พนักงานและสิทธิ์','สำรองข้อมูล'].map(x=><div className="row" key={x}><span>{x}</span><b>›</b></div>)}</section>}
  <nav>{[['หน้าหลัก',Home],['สินค้า',Package],['ขาย',ShoppingCart],['รายงาน',BarChart3],['ตั้งค่า',Settings]].map(([n,I]:any)=><button className={tab===n?'active':''} onClick={()=>setTab(n)} key={n}><I/><span>{n}</span></button>)}</nav>
 </main>
}
