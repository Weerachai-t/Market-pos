import { NextResponse } from 'next/server';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
export async function POST(request:Request){try{const {target,amount}=await request.json();if(!target)return NextResponse.json({error:'ยังไม่ได้ตั้งค่าหมายเลข PromptPay'},{status:400});const value=Number(amount);if(!value||value<=0)return NextResponse.json({error:'ยอดชำระไม่ถูกต้อง'},{status:400});const payload=generatePayload(String(target).replace(/[-\s]/g,''),{amount:value});const qr=await QRCode.toDataURL(payload,{width:420,margin:2,errorCorrectionLevel:'M'});return NextResponse.json({qr,payload,amount:value})}catch(e){console.error(e);return NextResponse.json({error:'สร้าง PromptPay QR ไม่สำเร็จ'},{status:500})}}
