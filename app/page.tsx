'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Banknote, BarChart3, Boxes, History, Home, Minus, Package,
  Pencil, Phone, Plus, QrCode, RefreshCw, Search, Settings, ShoppingCart,
  ImagePlus, LogOut, Trash2, UserPlus, UserRound, X,
} from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import EmployeePanel from './components/EmployeePanel';
import ReportPanel from './components/ReportPanel';
import ThemePanel from './components/ThemePanel';

type Product = { id:number; sku?:string; barcode?:string; qr_code?:string; name:string; price:number|string; cost?:number|string; stock_qty:number|string; low_stock_qty?:number|string; unit:string; category?:string; image_url?:string };
type Cart = Product & { qty:number };
type Dashboard = { todayRevenue:number; todayBills:number; products:number; lowStock:number };
type Customer = { id:number; name:string; phone:string; points_balance:number|string; total_spent:number|string; created_at?:string };
type PointTransaction = { id:number; sale_id?:number; transaction_type:'earn'|'redeem'|'adjust'; points:number; balance_after:number; description?:string; created_at:string };
type CustomerDetail = { customer:Customer; transactions:PointTransaction[]; sales:Array<{id:number;receipt_no:string;sold_at:string;total:number|string;points_earned:number;points_redeemed:number}> };
type Employee = { id:number;username:string;display_name:string;role:'admin'|'cashier';permissions:Record<string,boolean> };

const blank = { sku:'', barcode:'', qr_code:'', name:'', category:'', cost:'0', price:'0', stock_qty:'0', low_stock_qty:'5', unit:'ชิ้น', image_url:'' };
const emoji = (category?:string) => category === 'เครื่องดื่ม' ? '🥤' : category === 'อาหาร' ? '🍱' : category === 'เสื้อผ้า' ? '👕' : '📦';
const money = (value:number|string) => Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits:2 });
const thaiDate = (value:string) => new Date(value).toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' });

export default function Page() {
  const [tab,setTab] = useState('ขาย');
  const [products,setProducts] = useState<Product[]>([]);
  const [cart,setCart] = useState<Cart[]>([]);
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [paying,setPaying] = useState(false);
  const [message,setMessage] = useState('');
  const [dash,setDash] = useState<Dashboard>({ todayRevenue:0, todayBills:0, products:0, lowStock:0 });
  const [form,setForm] = useState<Record<string, any>>(blank);
  const [editing,setEditing] = useState<number|null>(null);
  const [showForm,setShowForm] = useState(false);
  const [stockProduct,setStockProduct] = useState<Product|null>(null);
  const [stockQty,setStockQty] = useState('');
  const [promptpay,setPromptpay] = useState('');
  const [qr,setQr] = useState('');
  const [customers,setCustomers] = useState<Customer[]>([]);
  const [memberQuery,setMemberQuery] = useState('');
  const [selectedCustomer,setSelectedCustomer] = useState<Customer|null>(null);
  const [redeemPoints,setRedeemPoints] = useState(0);
  const [showMemberForm,setShowMemberForm] = useState(false);
  const [memberForm,setMemberForm] = useState({ name:'', phone:'' });
  const [customerDetail,setCustomerDetail] = useState<CustomerDetail|null>(null);
  const [editingCustomerName,setEditingCustomerName] = useState<string|null>(null);
  const [savingCustomerName,setSavingCustomerName] = useState(false);
  const [employee,setEmployee] = useState<Employee|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [setupRequired,setSetupRequired] = useState(false);
  const [themeColor,setThemeColor] = useState('#111827');
  const checkoutReference = useRef<string|null>(null);

  useEffect(() => { setPromptpay(localStorage.getItem('promptpay') || ''); refreshSession(); }, []);
  useEffect(() => { if (employee && tab === 'สมาชิก') loadCustomers(); }, [tab,employee]);
  useEffect(() => {
    const hex = themeColor.replace('#','');
    const red = parseInt(hex.slice(0,2),16), green = parseInt(hex.slice(2,4),16), blue = parseInt(hex.slice(4,6),16);
    const contrast = (red*299 + green*587 + blue*114) / 1000 > 155 ? '#18202b' : '#ffffff';
    document.documentElement.style.setProperty('--brand', themeColor);
    document.documentElement.style.setProperty('--brand-contrast', contrast);
  }, [themeColor]);

  const refreshSession = async () => {
    setAuthLoading(true);
    try {
      const response=await fetch('/api/auth/session',{cache:'no-store'});
      const data=await response.json();
      setSetupRequired(Boolean(data.setupRequired));
      setEmployee(data.employee||null);
      if(data.employee)await load();
    } finally { setAuthLoading(false); }
  };

  const can = (permission:string) => employee?.role === 'admin' || employee?.permissions?.[permission] === true;
  const logout = async () => { await fetch('/api/auth/logout',{method:'POST'}); setEmployee(null); setCart([]); setTab('ขาย'); };

  const load = async () => {
    setLoading(true);
    try {
      const [productResponse,dashboardResponse,themeResponse] = await Promise.all([
        fetch('/api/products', { cache:'no-store' }),
        fetch('/api/dashboard', { cache:'no-store' }),
        fetch('/api/settings/theme', { cache:'no-store' }),
      ]);
      setProducts((await productResponse.json()).products || []);
      setDash(await dashboardResponse.json());
      if (themeResponse.ok) setThemeColor((await themeResponse.json()).color || '#111827');
    } finally { setLoading(false); }
  };

  const loadCustomers = async (phone = '') => {
    const response = await fetch(`/api/customers${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`, { cache:'no-store' });
    const data = await response.json();
    if (response.ok) setCustomers(data.customers || []);
  };

  const openCustomer = async (customer:Customer) => {
    const response = await fetch(`/api/customers/${customer.id}`, { cache:'no-store' });
    const data = await response.json();
    if (response.ok) { setCustomerDetail(data); setEditingCustomerName(null); }
    else setMessage(data.error);
  };

  const saveCustomerName = async () => {
    if (!customerDetail || editingCustomerName === null || savingCustomerName) return;
    setSavingCustomerName(true);
    try {
      const response = await fetch(`/api/customers/${customerDetail.customer.id}`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ name:editingCustomerName }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || 'แก้ไขชื่อสมาชิกไม่สำเร็จ');
      setCustomerDetail((current) => current ? {...current,customer:data.customer} : current);
      setCustomers((current) => current.map((customer) => customer.id === data.customer.id ? {...customer,...data.customer} : customer));
      setSelectedCustomer((current) => current?.id === data.customer.id ? {...current,...data.customer} : current);
      setEditingCustomerName(null);
      setMessage('✓ แก้ไขชื่อสมาชิกแล้ว');
    } catch { setMessage('เชื่อมต่อระบบเพื่อแก้ไขชื่อสมาชิกไม่สำเร็จ'); }
    finally { setSavingCustomerName(false); }
  };

  const createCustomer = async () => {
    const response = await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(memberForm) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setShowMemberForm(false);
    setMemberForm({ name:'', phone:'' });
    setSelectedCustomer(data.customer);
    setMemberQuery(data.customer.phone);
    setMessage('✓ บันทึกสมาชิกแล้ว');
    await loadCustomers();
  };

  const subtotal = cart.reduce((sum,item) => sum + Number(item.price) * item.qty, 0);
  const maxRedeem = selectedCustomer ? Math.min(Number(selectedCustomer.points_balance), Math.floor(subtotal)) : 0;
  const appliedRedeem = Math.min(Math.max(0, Math.floor(redeemPoints)), maxRedeem);
  const payable = Math.max(0, subtotal - appliedRedeem);
  const expectedPoints = selectedCustomer ? Math.floor(payable / 10) : 0;
  const count = cart.reduce((sum,item) => sum + item.qty, 0);
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.sku || ''} ${product.barcode || ''} ${product.qr_code || ''}`.toLowerCase().includes(query.toLowerCase())), [products,query]);

  const cartChanged = () => { checkoutReference.current = null; setQr(''); };
  const add = (product:Product) => {
    if (Number(product.stock_qty) <= 0) return;
    cartChanged();
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing && existing.qty >= Number(product.stock_qty)) return current;
      return existing ? current.map((item) => item.id === product.id ? {...item,qty:item.qty+1} : item) : [...current,{...product,qty:1}];
    });
  };
  const qty = (id:number,delta:number) => {
    cartChanged();
    setCart((current) => current.map((item) => item.id === id ? {...item,qty:Math.min(item.qty+delta,Number(item.stock_qty))} : item).filter((item) => item.qty > 0));
  };
  const clearCart = () => { cartChanged(); setCart([]); setRedeemPoints(0); };

  const checkout = async (method:'cash'|'promptpay') => {
    if (paying) return;
    setPaying(true);
    checkoutReference.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/sales', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          paymentMethod:method,
          items:cart.map((item) => ({ productId:item.id, quantity:item.qty })),
          customerId:selectedCustomer?.id ?? null,
          redeemPoints:appliedRedeem,
          cashReceived:method === 'cash' ? payable : null,
          clientReference:checkoutReference.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQr(''); setCart([]); setRedeemPoints(0); setSelectedCustomer(null); setMemberQuery('');
      checkoutReference.current = null;
      const pointText = data.pointsEarned ? ` • +${data.pointsEarned} คะแนน` : '';
      setMessage(`✓ บิล ${data.receiptNo} สำเร็จ ฿${money(data.total)}${pointText}`);
      await Promise.all([load(),loadCustomers()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกการขายไม่สำเร็จ');
    } finally { setPaying(false); }
  };

  const showPromptPay = async () => {
    if (!promptpay) return setMessage('กรุณาตั้งค่าหมายเลข PromptPay ก่อน');
    const response = await fetch('/api/promptpay', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({target:promptpay,amount:payable}) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setQr(data.qr);
  };

  const searchMembers = async () => { await loadCustomers(memberQuery); };
  const selectMember = (customer:Customer) => { setSelectedCustomer(customer); setMemberQuery(customer.phone); setRedeemPoints(0); };
  const openNew = () => { setEditing(null); setForm(blank); setShowForm(true); };
  const openEdit = (product:Product) => { setEditing(product.id); setForm({...product}); setShowForm(true); };
  const selectProductImage = async (file?:File) => {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return setMessage('รองรับรูป JPG, PNG และ WebP เท่านั้น');
    if (file.size > 8_000_000) return setMessage('กรุณาเลือกรูปต้นฉบับขนาดไม่เกิน 8 MB');
    try {
      const source = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      const picture = await new Promise<HTMLImageElement>((resolve,reject) => {
        const element = new window.Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('เปิดรูปไม่สำเร็จ'));
        element.src = source;
      });
      const scale = Math.min(1, 900 / Math.max(picture.width,picture.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(picture.width*scale));
      canvas.height = Math.max(1,Math.round(picture.height*scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ประมวลผลรูปไม่สำเร็จ');
      context.fillStyle = '#ffffff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(picture,0,0,canvas.width,canvas.height);
      const imageUrl = canvas.toDataURL('image/jpeg',0.82);
      if (imageUrl.length > 1_200_000) throw new Error('รูปมีรายละเอียดมากเกินไป กรุณาเลือกรูปอื่น');
      setForm((current) => ({...current,image_url:imageUrl}));
      setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'เตรียมรูปสินค้าไม่สำเร็จ'); }
  };
  const saveProduct = async () => {
    const response = await fetch(editing ? `/api/products/${editing}` : '/api/products', { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setShowForm(false); await load();
  };
  const del = async (product:Product) => { if (confirm(`ลบ ${product.name} ?`)) { await fetch(`/api/products/${product.id}`, {method:'DELETE'}); await load(); } };
  const adjustStock = async () => {
    if (!stockProduct || !Number(stockQty)) return;
    const response = await fetch('/api/stock', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({productId:stockProduct.id,quantity:Number(stockQty),type:Number(stockQty)>0?'receive':'adjust'}) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setStockProduct(null); setStockQty(''); await load();
  };

  if (authLoading) return <main className="authShell"><div className="authCard"><p>กำลังตรวจสอบบัญชี...</p></div></main>;
  if (!employee) return <AuthScreen setupRequired={setupRequired} onAuthenticated={refreshSession}/>;

  return <main className="shell">
    <header><div><small>MARKET POS • {employee.display_name}</small><h1>{tab}</h1></div><div className="headerActions"><button className="avatar" onClick={load} aria-label="รีเฟรช"><RefreshCw size={18}/></button><button className="avatar secondary" onClick={logout} aria-label="ออกจากระบบ"><LogOut size={18}/></button></div></header>
    {message && <p className={message.startsWith('✓')?'success':'notice'}>{message}</p>}

    {tab === 'หน้าหลัก' && <section>
      <div className="hero"><span>ยอดขายวันนี้</span><strong>฿{money(dash.todayRevenue)}</strong><small>{dash.todayBills} บิล</small></div>
      <div className="stats"><article><b>{dash.products}</b><span>สินค้า</span></article><article><b>{dash.lowStock}</b><span>ใกล้หมด</span></article></div>
      {can('manage_customers')&&<button className="memberShortcut" onClick={() => setTab('สมาชิก')}><UserRound/><span><b>สมาชิกและคะแนนสะสม</b><small>ค้นหา ดูยอดซื้อ และประวัติคะแนน</small></span></button>}
    </section>}

    {tab === 'ขาย' && can('sell') && <section>
      <div className="search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา / SKU / Barcode / QR"/></div>
      {loading ? <p>กำลังโหลด...</p> : <div className="grid">{filtered.map((product) => <button className="product" key={product.id} onClick={() => add(product)}>{product.image_url ? <Image className="productImage" src={product.image_url} alt={product.name} width={320} height={180} unoptimized/> : <span className="emoji">{emoji(product.category)}</span>}<b>{product.name}</b><small>เหลือ {product.stock_qty} {product.unit}</small><strong>฿{money(product.price)}</strong></button>)}</div>}
      {cart.length > 0 && <div className="cart">
        <div className="cartTitle"><b><ShoppingCart/> ตะกร้า ({count})</b><button onClick={clearCart} aria-label="ล้างตะกร้า"><Trash2/></button></div>
        {cart.map((item) => <div className="cartRow" key={item.id}><span>{item.name}<small>฿{money(item.price)}</small></span><div><button onClick={() => qty(item.id,-1)}><Minus/></button><b>{item.qty}</b><button onClick={() => qty(item.id,1)}><Plus/></button></div></div>)}
        <div className="memberBox">
          <b><UserRound/> สมาชิก</b>
          {selectedCustomer ? <div className="selectedMember"><span><strong>{selectedCustomer.name}</strong><small>{selectedCustomer.phone} • {selectedCustomer.points_balance} คะแนน</small></span><button onClick={() => {setSelectedCustomer(null);setMemberQuery('');setRedeemPoints(0)}}><X/></button></div> : <><div className="memberSearch"><input inputMode="tel" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="ค้นหาด้วยเบอร์โทร"/><button onClick={searchMembers}><Search/></button></div>{memberQuery && customers.slice(0,3).map((customer) => <button className="memberResult" key={customer.id} onClick={() => selectMember(customer)}><span>{customer.name}<small>{customer.phone}</small></span><b>{customer.points_balance} แต้ม</b></button>)}</>}
          {selectedCustomer && <label className="redeem"><span>ใช้คะแนน (1 คะแนน = 1 บาท)</span><input type="number" min="0" max={maxRedeem} value={redeemPoints} onChange={(event) => setRedeemPoints(Math.min(maxRedeem,Math.max(0,Number(event.target.value))))}/><small>ใช้ได้สูงสุด {maxRedeem} คะแนน • บิลนี้จะได้รับ {expectedPoints} คะแนน</small></label>}
        </div>
        <div className="summary"><span>ยอดสินค้า <b>฿{money(subtotal)}</b></span>{appliedRedeem > 0 && <span className="discount">ส่วนลดคะแนน <b>-฿{money(appliedRedeem)}</b></span>}</div>
        <div className="total"><span>ยอดชำระ</span><strong>฿{money(payable)}</strong></div>
        <div className="pay"><button disabled={paying} onClick={() => checkout('cash')}><Banknote/> เงินสด</button><button disabled={paying} onClick={showPromptPay}><QrCode/> QR PromptPay</button></div>
      </div>}
    </section>}

    {tab === 'สมาชิก' && (can('manage_customers')||can('sell')) && <section>
      <div className="manageHead"><b>สมาชิกทั้งหมด</b><button className="primary" onClick={() => setShowMemberForm(true)}><UserPlus/> เพิ่มสมาชิก</button></div>
      <div className="search"><Phone/><input inputMode="tel" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="ค้นหาด้วยเบอร์โทร"/><button className="searchButton" onClick={() => loadCustomers(memberQuery)}><Search/></button></div>
      <div className="memberList">{customers.map((customer) => <button className="customerCard" key={customer.id} onClick={() => openCustomer(customer)}><span><b>{customer.name}</b><small>{customer.phone}</small><small>ยอดซื้อ ฿{money(customer.total_spent)}</small></span><strong><Award/> {customer.points_balance}</strong></button>)}</div>
    </section>}

    {tab === 'สินค้า' && <section><div className="manageHead"><b>{can('manage_products')?'จัดการสินค้า':'รายการสินค้า'}</b>{can('manage_products')&&<button className="primary" onClick={openNew}><Plus/> เพิ่มสินค้า</button>}</div>{filtered.map((product) => <div className="manageRow" key={product.id}><div className="prodInfo">{product.image_url ? <Image className="productThumb" src={product.image_url} alt={product.name} width={58} height={58} unoptimized/> : <span>{emoji(product.category)}</span>}<div><b>{product.name}</b><small>{product.sku||'-'} • ฿{money(product.price)} • {product.stock_qty} {product.unit}</small>{product.qr_code && <small>QR: {product.qr_code}</small>}</div></div>{can('manage_products')&&<div className="actions"><button onClick={() => setStockProduct(product)} aria-label={`ปรับสต๊อก ${product.name}`}><Boxes/></button><button onClick={() => openEdit(product)} aria-label={`แก้ไข ${product.name}`}><Pencil/></button><button onClick={() => del(product)} aria-label={`ลบ ${product.name}`}><Trash2/></button></div>}</div>)}</section>}
    {tab === 'รายงาน' && can('view_reports') && <ReportPanel/>}
    {tab === 'ตั้งค่า' && <section>{employee.role==='admin'&&<ThemePanel color={themeColor} onChange={setThemeColor}/>}<div className="settingsSection"><h2>PromptPay / QR รับเงิน</h2><div className="hero"><span>หมายเลข PromptPay ร้านค้า</span><input className="bigInput" value={promptpay} onChange={(event) => setPromptpay(event.target.value)} placeholder="เบอร์มือถือ หรือเลขประจำตัวผู้เสียภาษี"/><button className="save" onClick={() => {localStorage.setItem('promptpay',promptpay);setMessage('✓ บันทึก PromptPay แล้ว')}}>บันทึก PromptPay</button></div><p>สมาชิกได้รับ 1 คะแนนทุกยอดชำระ 10 บาท และใช้ 1 คะแนนแทนเงินสดได้ 1 บาท</p></div>{employee.role==='admin'&&<EmployeePanel/>}</section>}

    {qr && <div className="overlay"><div className="modal payModal"><div className="modalHead"><b>สแกนเพื่อชำระเงิน</b><button onClick={() => setQr('')}><X/></button></div><div className="qrWrap"><Image src={qr} alt="PromptPay QR" width={340} height={340} unoptimized/><span>ยอดชำระ</span><strong>฿{money(payable)}</strong><small>PromptPay • กรุณาตรวจสอบยอดเงินเข้าก่อนยืนยัน</small></div><button className="save" disabled={paying} onClick={() => checkout('promptpay')}>ได้รับเงินแล้ว • ยืนยันการขาย</button></div></div>}
    {showForm && <div className="overlay"><div className="modal"><div className="modalHead"><b>{editing?'แก้ไขสินค้า':'เพิ่มสินค้า'}</b><button onClick={() => setShowForm(false)}><X/></button></div><div className="productImageEditor">{form.image_url ? <Image src={form.image_url} alt="ตัวอย่างรูปสินค้า" width={220} height={150} unoptimized/> : <div><ImagePlus/><span>ยังไม่มีรูปสินค้า</span></div>}<span className="imageEditorActions"><label className="imagePicker"><ImagePlus/> เลือกรูป<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProductImage(event.target.files?.[0])}/></label>{form.image_url&&<button type="button" onClick={() => setForm({...form,image_url:''})}>ลบรูป</button>}</span><small>ระบบจะย่อรูปอัตโนมัติ • รองรับ JPG, PNG, WebP ไม่เกิน 8 MB</small></div><div className="formGrid">{[['sku','SKU'],['barcode','Barcode'],['qr_code','ข้อมูล QR Code'],['name','ชื่อสินค้า'],['category','หมวดหมู่'],['cost','ราคาทุน'],['price','ราคาขาย'],['low_stock_qty','แจ้งเตือนเมื่อเหลือ'],['unit','หน่วย']].map(([key,label]) => <label key={key}><span>{label}</span><input value={form[key]??''} onChange={(event) => setForm({...form,[key]:event.target.value})}/></label>)}{!editing && <label><span>สต๊อกเริ่มต้น</span><input value={form.stock_qty} onChange={(event) => setForm({...form,stock_qty:event.target.value})}/></label>}</div><button className="save" onClick={saveProduct}>บันทึกสินค้า</button></div></div>}
    {stockProduct && <div className="overlay"><div className="modal"><div className="modalHead"><b>ปรับสต๊อก • {stockProduct.name}</b><button onClick={() => setStockProduct(null)}><X/></button></div><input className="bigInput" type="number" value={stockQty} onChange={(event) => setStockQty(event.target.value)} placeholder="+ รับเข้า / - ปรับออก"/><button className="save" onClick={adjustStock}>บันทึกสต๊อก</button></div></div>}
    {showMemberForm && <div className="overlay"><div className="modal smallModal"><div className="modalHead"><b>เพิ่มสมาชิก</b><button onClick={() => setShowMemberForm(false)}><X/></button></div><label><span>ชื่อสมาชิก</span><input className="bigInput" value={memberForm.name} onChange={(event) => setMemberForm({...memberForm,name:event.target.value})}/></label><label><span>เบอร์โทร</span><input className="bigInput" inputMode="tel" value={memberForm.phone} onChange={(event) => setMemberForm({...memberForm,phone:event.target.value})}/></label><button className="save" onClick={createCustomer}>บันทึกสมาชิก</button></div></div>}
    {customerDetail && <div className="overlay"><div className="modal"><div className="modalHead"><b>{customerDetail.customer.name}</b><div className="modalHeadActions">{can('manage_customers')&&<button onClick={() => setEditingCustomerName(customerDetail.customer.name)} aria-label="แก้ไขชื่อสมาชิก"><Pencil/></button>}<button onClick={() => {setCustomerDetail(null);setEditingCustomerName(null)}} aria-label="ปิด"><X/></button></div></div>{editingCustomerName!==null&&<div className="editMemberName"><label><span>ชื่อสมาชิก</span><input autoFocus maxLength={120} value={editingCustomerName} onChange={(event) => setEditingCustomerName(event.target.value)}/></label><div><button type="button" onClick={() => setEditingCustomerName(null)}>ยกเลิก</button><button type="button" className="primary" disabled={savingCustomerName||!editingCustomerName.trim()} onClick={saveCustomerName}>{savingCustomerName?'กำลังบันทึก...':'บันทึกชื่อ'}</button></div></div>}<div className="memberStats"><article><Award/><b>{customerDetail.customer.points_balance}</b><small>คะแนนคงเหลือ</small></article><article><Banknote/><b>฿{money(customerDetail.customer.total_spent)}</b><small>ยอดซื้อสะสม</small></article></div><h2><History/> ประวัติคะแนน</h2>{customerDetail.transactions.length ? customerDetail.transactions.map((transaction) => <div className="historyRow" key={transaction.id}><span><b>{transaction.description || 'รายการคะแนน'}</b><small>{thaiDate(transaction.created_at)} • คงเหลือ {transaction.balance_after}</small></span><strong className={transaction.points > 0 ? 'pointPlus' : 'pointMinus'}>{transaction.points > 0 ? '+' : ''}{transaction.points}</strong></div>) : <p className="empty">ยังไม่มีประวัติคะแนน</p>}</div></div>}

    <nav>{[['หน้าหลัก',Home,true],['สมาชิก',UserRound,can('manage_customers')||can('sell')],['สินค้า',Package,true],['ขาย',ShoppingCart,can('sell')],['รายงาน',BarChart3,can('view_reports')],['ตั้งค่า',Settings,true]].filter((item)=>item[2]).map(([name,Icon]:any) => <button className={`${tab===name?'active ':''}${name==='ขาย'?'saleNav':''}`} onClick={() => setTab(name)} key={name}><Icon/><span>{name}</span></button>)}</nav>
  </main>;
}
