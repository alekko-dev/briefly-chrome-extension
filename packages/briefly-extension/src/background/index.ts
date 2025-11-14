console.log('Briefly background service worker loaded');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message);

  // Handle any background processing here if needed
  sendResponse({ success: true });

  return true;
});

// Optional: Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Briefly extension installed');
  } else if (details.reason === 'update') {
    console.log('Briefly extension updated');
  }
});
