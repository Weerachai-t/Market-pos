import { getDb } from './db';

export type SubscriptionContext = {
  plan_code:string;
  plan_name:string;
  billing_cycle:string;
  status:string;
  effective_status:'trial'|'active'|'past_due'|'expired'|'cancelled';
  starts_at:string;
  expires_at:string;
  user_limit:number;
  product_limit:number;
  branch_limit:number;
  users:number;
  products:number;
  branches:number;
};

export async function getSubscriptionContext(tenantId:number):Promise<SubscriptionContext|null> {
  const sql=getDb();
  const rows=await sql`
    SELECT s.plan_code,p.name AS plan_name,s.billing_cycle,s.status,s.starts_at,s.expires_at,
           p.user_limit,p.product_limit,p.branch_limit,
           (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id=s.tenant_id AND u.is_active=TRUE) AS users,
           (SELECT COUNT(*)::int FROM products pr WHERE pr.tenant_id=s.tenant_id AND pr.is_active=TRUE) AS products,
           (SELECT COUNT(*)::int FROM branches b WHERE b.tenant_id=s.tenant_id AND b.is_active=TRUE) AS branches
      FROM subscriptions s
      JOIN subscription_plans p ON p.code=s.plan_code
     WHERE s.tenant_id=${tenantId}
       AND s.status IN ('trial','active','past_due')
     ORDER BY s.expires_at DESC
     LIMIT 1
  `;
  if(!rows[0]) return null;
  const row=rows[0];
  const expired=new Date(String(row.expires_at)).getTime()<=Date.now();
  return {
    ...row,
    effective_status: expired ? 'expired' : row.status,
    user_limit:Number(row.user_limit), product_limit:Number(row.product_limit), branch_limit:Number(row.branch_limit),
    users:Number(row.users), products:Number(row.products), branches:Number(row.branches),
    starts_at:String(row.starts_at), expires_at:String(row.expires_at),
  } as SubscriptionContext;
}

export async function requireActiveSubscription(tenantId:number) {
  const subscription=await getSubscriptionContext(tenantId);
  if(!subscription || !['trial','active'].includes(subscription.effective_status)) {
    throw new Error('SUBSCRIPTION_EXPIRED');
  }
  return subscription;
}

export function assertPlanLimit(subscription:SubscriptionContext, resource:'users'|'products'|'branches') {
  const limitKey=resource==='users'?'user_limit':resource==='products'?'product_limit':'branch_limit';
  if(subscription[resource] >= subscription[limitKey]) throw new Error(`PLAN_LIMIT_${resource.toUpperCase()}`);
}
