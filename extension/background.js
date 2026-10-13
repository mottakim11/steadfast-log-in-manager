// Steadfast Secure Login Manager - Background Service Worker
// Disables Chrome's built-in "Save password?" prompt and handles background tasks

function disablePasswordManager() {
  if (chrome.privacy && chrome.privacy.services && chrome.privacy.services.passwordSavingEnabled) {
    chrome.privacy.services.passwordSavingEnabled.set({ value: false }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Could not set passwordSavingEnabled:', chrome.runtime.lastError.message);
      } else {
        console.log('Chrome password manager prompt successfully disabled.');
      }
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  disablePasswordManager();
});

chrome.runtime.onStartup.addListener(() => {
  disablePasswordManager();
});

// Run immediately upon worker start
disablePasswordManager();
