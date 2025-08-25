// Test script to diagnose connection issues between frontend and backend

const API_URL = process.env.VITE_API_URL || 'https://motion-detector-upa2.onrender.com/api/v1';

console.log('Testing API connection to:', API_URL);
console.log('-----------------------------------');

// Test 1: Health check endpoint
async function testHealthCheck() {
  console.log('\n1. Testing health check endpoint...');
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response:`, data);
      console.log('   ✅ Health check successful!');
    } else {
      console.log('   ❌ Health check failed!');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Test 2: CORS preflight request
async function testCORS() {
  console.log('\n2. Testing CORS preflight...');
  const origin = 'https://feature-render-deployment.motion-detector.pages.dev';
  
  try {
    const response = await fetch(`${API_URL}/ai/analyze-image`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Access-Control-Allow-Origin: ${response.headers.get('Access-Control-Allow-Origin')}`);
    console.log(`   Access-Control-Allow-Methods: ${response.headers.get('Access-Control-Allow-Methods')}`);
    console.log(`   Access-Control-Allow-Headers: ${response.headers.get('Access-Control-Allow-Headers')}`);
    
    if (response.status === 200 || response.status === 204) {
      console.log('   ✅ CORS preflight successful!');
    } else {
      console.log('   ❌ CORS preflight failed!');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Test 3: Simple POST request
async function testAnalyzeEndpoint() {
  console.log('\n3. Testing analyze endpoint with minimal data...');
  
  // Create a minimal test image (1x1 transparent PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  try {
    const response = await fetch(`${API_URL}/ai/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://feature-render-deployment.motion-detector.pages.dev',
      },
      body: JSON.stringify({
        image_base64: testImageBase64,
        prompt: 'Test connection only'
      }),
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response success: ${data.success}`);
      if (data.error_message) {
        console.log(`   Error message: ${data.error_message}`);
      }
      console.log('   ✅ Endpoint reachable!');
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Request failed: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  await testHealthCheck();
  await testCORS();
  await testAnalyzeEndpoint();
  
  console.log('\n-----------------------------------');
  console.log('Connection tests complete!');
}

runTests();