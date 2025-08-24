#!/usr/bin/env node
/**
 * Test script to verify API connection
 * Run with: node test-api-connection.js
 */

const API_URL = process.env.VITE_API_URL || 'https://motion-detector-api.onrender.com/api/v1';

async function testApiConnection() {
    console.log(`🔍 Testing API connection to: ${API_URL}`);
    
    // Test health endpoint
    try {
        const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Health check passed:', data);
        } else {
            console.log('❌ Health check failed:', response.status, response.statusText);
        }
    } catch (error) {
        console.log('❌ Health check error:', error.message);
    }
    
    // Test prompts endpoint
    try {
        const response = await fetch(`${API_URL}/ai/prompts`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Prompts endpoint working:', data);
        } else {
            console.log('❌ Prompts endpoint failed:', response.status);
        }
    } catch (error) {
        console.log('❌ Prompts endpoint error:', error.message);
    }
    
    console.log('\n🎯 If both tests pass, your frontend can connect to the API!');
}

testApiConnection();