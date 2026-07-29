#!/usr/bin/env node
/**
 * POS Webhook Test Script
 * Tests all new POS fields
 */

const BASE_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMjU0MzIwMCwiZXhwIjoxOTM4MTE5MjAwfQ.O3UVNRdOTlewfkXj9dFUYnB9Q2lF4eJ8cKQ7R0M1K5c';

async function callWebhook(payload) {
  const response = await fetch(`${BASE_URL}/pos-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function runTests() {
  console.log('🧪 POS Webhook Test Suite\n');
  console.log('='.repeat(50));

  // Test 1: Minimal valid payload
  console.log('\n📋 Test 1: Minimal Payload (MVP)');
  const test1 = await callWebhook({
    transaction_id: `MIN-${Date.now()}`,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 25.00
  });
  console.log('Result:', JSON.stringify(test1, null, 2));
  console.log(test1.success ? '✅ PASS' : '❌ FAIL');

  // Test 2: Full payment fields
  console.log('\n📋 Test 2: Full Payment Fields');
  const test2 = await callWebhook({
    transaction_id: `PAY-${Date.now()}`,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 50.00,
    transaction_count: 3,
    payment_method: 'qrcode',
    customer_id: 'CUST-001',
    staff_id: 'STAFF-001',
    discount: 5.00,
    tax: 4.95,
    cost: 20.00
  });
  console.log('Result:', JSON.stringify(test2, null, 2));
  console.log(test2.success ? '✅ PASS' : '❌ FAIL');

  // Test 3: GoFood platform
  console.log('\n📋 Test 3: GoFood Platform');
  const test3 = await callWebhook({
    transaction_id: `GFD-${Date.now()}`,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 35.00,
    transaction_count: 2,
    payment_method: 'gofood',
    platform: 'gofood',
    platform_order_id: 'GF-123456789',
    platform_fee: 8.05,
    settlement_amount: 26.95
  });
  console.log('Result:', JSON.stringify(test3, null, 2));
  console.log(test3.success ? '✅ PASS' : '❌ FAIL');

  // Test 4: GrabFood platform
  console.log('\n📋 Test 4: GrabFood Platform');
  const test4 = await callWebhook({
    transaction_id: `GRB-${Date.now()}`,
    outlet_id: 2,
    date: '2024-07-25',
    amount: 42.00,
    payment_method: 'grabfood',
    platform: 'grabfood',
    platform_order_id: 'GB-987654321',
    platform_fee: 9.66
  });
  console.log('Result:', JSON.stringify(test4, null, 2));
  console.log(test4.success ? '✅ PASS' : '❌ FAIL');

  // Test 5: Validation - Missing required fields
  console.log('\n📋 Test 5: Validation - Missing Fields');
  const test5 = await callWebhook({
    outlet_id: 1
    // missing transaction_id, date, amount
  });
  console.log('Result:', JSON.stringify(test5, null, 2));
  console.log(!test5.success && test5.errors ? '✅ PASS (validation working)' : '❌ FAIL');

  // Test 6: Validation - Invalid payment method
  console.log('\n📋 Test 6: Validation - Invalid Payment');
  const test6 = await callWebhook({
    transaction_id: `INV-${Date.now()}`,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 25.00,
    payment_method: 'bitcoin' // invalid
  });
  console.log('Result:', JSON.stringify(test6, null, 2));
  console.log(!test6.success ? '✅ PASS (validation working)' : '❌ FAIL');

  // Test 7: Duplicate transaction_id
  console.log('\n📋 Test 7: Duplicate Transaction');
  const duplicateId = `DUP-${Date.now()}`;
  await callWebhook({
    transaction_id: duplicateId,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 25.00
  });
  const test7 = await callWebhook({
    transaction_id: duplicateId,
    outlet_id: 1,
    date: '2024-07-25',
    amount: 30.00
  });
  console.log('Result:', JSON.stringify(test7, null, 2));
  console.log(!test7.success && test7.error === 'Duplicate transaction_id' ? '✅ PASS (dedup working)' : '❌ FAIL');

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test Suite Complete');
}

runTests().catch(console.error);
