// Get the blocking toggle and blocked count elements
const blockingToggle = document.getElementById("blocking-toggle");
const blockedCount = document.getElementById("blocked-count");

// Load the saved state when popup opens
chrome.storage.local.get(["isEnabled", "blockedCount"], (result) => {
  // Set toggle state (default to true if not set)
  blockingToggle.checked = result.isEnabled !== false;

  // Update blocked count
  blockedCount.textContent = result.blockedCount || 0;
});

// Listen for changes to the toggle
blockingToggle.addEventListener("change", (e) => {
  const isEnabled = e.target.checked;

  // Save the state
  chrome.storage.local.set({ isEnabled });

  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleBlocking",
        isEnabled: isEnabled,
      });
    }
  });
});
