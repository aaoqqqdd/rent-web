/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// The public checkout and console read the same encrypted D1 platform account.
export async function platformStripeFixture(){
  const encryptionKey='platform-test-encryption-key'
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encryptionKey))
  const key=await crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt'])
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('sk_test_platform'))
  const config={publishableKey:'pk_test_platform',secretKey:Buffer.from(iv).toString('base64')+'.'+Buffer.from(encrypted).toString('base64')}
  return {encryptionKey,config}
}
