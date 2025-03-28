// Get the blocking toggle and blocked count elements
const blockingToggle = document.getElementById("blocking-toggle");
const deleteModeToggle = document.getElementById("delete-mode-toggle");
const blockedCount = document.getElementById("blocked-count");

// Load the saved state when popup opens
chrome.storage.local.get(["isEnabled", "deleteMode", "blockedCount"], (result) => {
  // Set toggle states (default to true if not set)
  blockingToggle.checked = result.isEnabled !== false;
  deleteModeToggle.checked = result.deleteMode !== false;

  // Update blocked count
  blockedCount.textContent = result.blockedCount || 0;

  // Disable delete mode toggle if blocking is disabled
  deleteModeToggle.disabled = !blockingToggle.checked;
});

// Listen for changes to the blocking toggle
blockingToggle.addEventListener("change", (e) => {
  const isEnabled = e.target.checked;

  // Enable/disable delete mode toggle based on blocking state
  deleteModeToggle.disabled = !isEnabled;

  // Save the state
  chrome.storage.local.set({ isEnabled });

  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleBlocking",
        isEnabled: isEnabled,
        deleteMode: deleteModeToggle.checked,
      });
    }
  });
});

// Listen for changes to the delete mode toggle
deleteModeToggle.addEventListener("change", (e) => {
  const deleteMode = e.target.checked;

  // Save the state
  chrome.storage.local.set({ deleteMode });

  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleDeleteMode",
        deleteMode: deleteMode,
      });
    }
  });
});
