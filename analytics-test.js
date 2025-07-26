// Analytics Testing Script
// Add this to browser console when testing the app

// Test analytics functionality
function testAnalytics() {
    console.log('Testing Vercel Analytics Integration...');
    
    // Test basic tracking (this would normally be done through the UI)
    if (typeof window !== 'undefined' && window.va) {
        console.log('✓ Vercel Analytics loaded successfully');
        
        // These events would normally be triggered by user interactions
        console.log('Analytics events to test:');
        console.log('1. Search for a city → should trigger "weather_search"');
        console.log('2. Click "My Location" → should trigger "geolocation_requested"');
        console.log('3. Add/remove favorites → should trigger "favorite_added/removed"');
        console.log('4. Switch tabs → should trigger "tab_changed"');
        console.log('5. Open/close modals → should trigger "modal_opened/closed"');
        console.log('6. Change provider/units → should trigger "settings_changed"');
        
        return true;
    } else {
        console.log('⚠ Vercel Analytics not yet loaded or not in production');
        return false;
    }
}

// Run test
testAnalytics();
