// Audit reproductions: a PASS confirms the named defect exists, not readiness.
// All database and payment writes are mocked. No real credentials/services used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
const require = createRequire(import.meta.url);
function stub(path: string, exports: unknown) { require.cache[require.resolve(path)] = { exports } as NodeModule; }
const productId='c1234567890123456789012345';
let order: any;
let failSave=false;
let coupon: any=null;
let qaWrites=0;
const db={
 user:{findUnique:async()=>({isMember:true,membershipExpiry:null})},
 product:{findMany:async()=>[{id:productId,name:'Audit fixture',basePrice:10,memberPrice:10,stock:100,productVariants:[]}]},
 coupon:{findUnique:async()=>coupon},
 testResult:{upsert:async({create}:any)=>{qaWrites++;return create;}},
 order:{findUnique:async()=>null,
 create:async({data}:any)=>{order={...data,id:productId,user:{email:'audit@example.com'},address:data.address.create,items:data.items.create.map((i:any)=>({...i,product:{name:'Audit fixture'}}))};return order;},
 update:async({data}:any)=>{if(data.paywayTransactionId&&failSave){failSave=false;throw new Error('Simulated commit failure after provider success');} Object.assign(order,data);return order;}}
};
stub('../../auth',{auth:async()=>({user:{id:'audit-user',email:'audit@example.com',role:'CUSTOMER'}})});
stub('../../lib/db',{db});
stub('../../lib/brevo',{sendOrderConfirmationEmail:async()=>{},sendShippingUpdateEmail:async()=>{}});
stub('../../lib/twilio',{sendOrderConfirmationSms:async()=>{},sendOrderWhatsApp:async()=>{},sendShippingUpdateSms:async()=>{}});
const checkout=require('../../app/api/checkout/session/route').POST;
const qa=require('../../app/api/qa/results/route').PUT;
const shippit=require('../../app/api/webhooks/shippit/route').POST;
const {hashPassword}=require('../../lib/password');
const address={name:'Audit Test',phone:'0400000000',line1:'1 Test Street',suburb:'Sydney',state:'NSW',postcode:'2000',country:'AU'};
const body={items:[{productId,quantity:3}],address,idempotencyKey:'6b620acb-5819-43f9-961e-1c1cdd331233'};
function req(path:string,data:unknown){return new NextRequest('https://audit.example'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});}
function env(t:any){const values={PAYMENT_GATEWAY:'onlinepay',ONLINEPAY_MODE:'test',ONLINEPAY_RETURN_BASE_URL:'https://audit.example',ONLINEPAY_USER_UID:'test',ONLINEPAY_API_KEY:'test',ONLINEPAY_ENTITY_ID:'test',ONLINEPAY_PPC_ID:'test',ONLINEPAY_3DS_ID:'test',AUTH_SECRET:'audit-fixture-only'};for(const [k,v]of Object.entries(values)){const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});} t.mock.method(console,'error',()=>{});}
test('AUDIT: ambiguous OnlinePay timeout cancels regular order and invites a new payment',async t=>{
 env(t);coupon=null;failSave=false;
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Simulated lost provider response');});
 const response=await checkout(req('/api/checkout/session',body));
 assert.equal(response.status,502);assert.equal(order.status,'CANCELLED');assert.equal((await response.json()).retryWithNewKey,true);
});
test('AUDIT: successful hosted checkout followed by failed ID save cancels regular order',async t=>{
 env(t);coupon=null;failSave=true;
 t.mock.method(globalThis,'fetch',async()=>Response.json({id:'checkout-audit-123',url:'https://provider.example/checkout'}));
 const response=await checkout(req('/api/checkout/session',body));
 assert.equal(response.status,502);assert.equal(order.status,'CANCELLED');assert.equal((await response.json()).retryWithNewKey,true);
});
test('AUDIT: $1 coupon on three $10 units charges $29.01 subtotal instead of displayed $29',async t=>{
 env(t);failSave=false;coupon={id:'coupon',code:'AUDIT',isActive:true,type:'ALL',discountType:'FIXED',discountValue:1,products:[],categories:[],memberEligibility:'ALL'};
 t.mock.method(globalThis,'fetch',async()=>Response.json({id:'checkout-audit-123',url:'https://provider.example/checkout'}));
 const response=await checkout(req('/api/checkout/session',{...body,couponCode:'AUDIT'}));
 assert.equal(response.status,200);assert.equal(order.discount,1);assert.equal(order.subtotal,29.01);assert.equal(order.total,31.91);
});
test('AUDIT: QA results can be written with no cookie or authorization header',async t=>{
 t.mock.method(console,'log',()=>{});qaWrites=0;
 const response=await qa(new NextRequest('https://audit.example/api/qa/results',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({testId:'audit-only',suite:'audit',status:'PASSED'})}));
 assert.equal(response.status,200);assert.equal(qaWrites,1);
});
test('AUDIT: delayed signed shipping event overwrites REFUNDED as SHIPPED',async t=>{
 const old=process.env.SHIPPIT_WEBHOOK_SECRET;process.env.SHIPPIT_WEBHOOK_SECRET='audit-only';t.after(()=>{if(old===undefined)delete process.env.SHIPPIT_WEBHOOK_SECRET;else process.env.SHIPPIT_WEBHOOK_SECRET=old;});
 order={id:productId,status:'REFUNDED',user:null,guestEmail:null,guestPhone:null};
 const payload=JSON.stringify({retailer_invoice:productId,state:'dispatched',tracking_number:'audit',courier_name:'Audit'});
 const signature=createHmac('sha256','audit-only').update(payload).digest('hex');
 const response=await shippit(new NextRequest('https://audit.example/api/webhooks/shippit',{method:'POST',headers:{'x-shippit-hmac-sha256':signature},body:payload}));
 assert.equal(response.status,200);assert.equal(order.status,'SHIPPED');
});
test('AUDIT: password hash is exactly one SHA256(salt + password)',async()=>{
 const password='audit-fixture-only';const stored=await hashPassword(password);const [salt,hash]=stored.split(':');
 assert.equal(hash,createHash('sha256').update(salt+password).digest('hex'));
});
