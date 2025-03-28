// Global state
let isEnabled = true;
let deleteMode = true;
let blockedCount = 0;

// Load initial state
chrome.storage.local.get(["isEnabled", "deleteMode", "blockedCount"], (result) => {
  isEnabled = result.isEnabled !== false;
  deleteMode = result.deleteMode !== false;
  blockedCount = result.blockedCount || 0;
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleBlocking") {
    isEnabled = message.isEnabled;
    deleteMode = message.deleteMode;
    console.log(`Blocking toggled: isEnabled = ${isEnabled}, deleteMode = ${deleteMode}`);
  } else if (message.action === "toggleDeleteMode") {
    deleteMode = message.deleteMode;
    console.log(`Delete mode toggled: deleteMode = ${deleteMode}`);
  }
});

// CSS for blur overlay
const blurStyle = `
  .ghibli-blur-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
  }
  .ghibli-blur-text {
    color: white;
    font-size: 14px;
    text-align: center;
    padding: 10px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 5px;
  }
`;

// Add blur styles to document
const styleSheet = document.createElement("style");
styleSheet.textContent = blurStyle;
document.head.appendChild(styleSheet);

// Function to create blur overlay
function createBlurOverlay(tweet) {
  const overlay = document.createElement("div");
  overlay.className = "ghibli-blur-overlay";

  const text = document.createElement("div");
  text.className = "ghibli-blur-text";
  text.textContent = "Ghibli content detected (click to reveal)";

  overlay.appendChild(text);

  // Add click handler to remove overlay
  overlay.addEventListener("click", () => {
    overlay.remove();
  });

  return overlay;
}

// Function to check if an image is Ghibli
async function isGhibliImage(imageUrl) {
  console.log(`Checking image: ${imageUrl}`);
  try {
    console.log("Sending request to prediction API...");
    const response = await fetch("https://no-ghibli.onrender.com/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!response.ok) {
      console.error(`API request failed with status: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log("Prediction result:", data);
    return data.predicted_class === "Ghibli";
  } catch (error) {
    console.error("Error checking image:", error);
    return false;
  }
}

// Function to process a tweet
async function processTweet(tweet) {
  if (!isEnabled) {
    console.log("Tweet processing skipped - blocking is disabled");
    return;
  }

  console.log("Processing tweet:", tweet);

  try {
    const mediaUrls = new Set();
    const observerPromises = [];

    const imageDivs = Array.from(tweet.querySelectorAll("a")).filter((a) =>
      a.href.includes("photo")
    );
    const videoDivs = Array.from(tweet.querySelectorAll("div[aria-label='Embedded video']"));

    // Create a promise for each image div observer
    [...imageDivs, ...videoDivs].forEach((div) => {
      const observerPromise = new Promise((resolve) => {
        const imageObserver = new MutationObserver((mutations, observer) => {
          const img = div.querySelector('img[draggable="true"]');
          if (img) {
            console.log("Image appeared:", img);
            if (img.src && img.src.includes("pbs.twimg.com")) {
              mediaUrls.add(img.src);
            }
            observer.disconnect();
            resolve(); // Resolve the promise when image is found
          }
        });

        imageObserver.observe(div, {
          childList: true,
          subtree: true,
        });

        // Add a timeout to resolve if image never appears
        setTimeout(() => {
          imageObserver.disconnect();
          resolve();
        }, 5000); // 5 second timeout
      });
      observerPromises.push(observerPromise);
    });

    // Wait for all observers to complete
    await Promise.all(observerPromises);

    // Now process background images
    const styledElements = tweet.querySelectorAll('[style*="background-image"]');
    styledElements.forEach((el) => {
      const bgImage = el.style.backgroundImage;
      const regex = /url\(["']?(.*?)["']?\)/;
      const match = regex.exec(bgImage);
      if (match && match[1] && match[1].includes("pbs.twimg.com")) {
        mediaUrls.add(match[1]);
      }
    });

    const uniqueUrls = [...new Set(Array.from(mediaUrls))]
      .map((url) => url.replace(/[^\w\d:/.?&=\-_%]+$/, ""))
      .filter(
        (url) => url.includes("twimg.com/media") || url.includes("twimg.com/ext_tw_video_thumb")
      );

    console.log("Unique image URLs:", uniqueUrls);

    if (uniqueUrls.length === 0) {
      console.log("WARNING: No media URLs found in tweet!");
      return;
    }

    // Process each image URL
    for (const url of uniqueUrls) {
      const isGhibli = await isGhibliImage(url);
      console.log(`Image Ghibli detection result: ${isGhibli}`);

      if (isGhibli) {
        const tweetContainer = tweet.closest("article");
        console.log("Found tweet container:", tweetContainer);

        if (tweetContainer) {
          if (deleteMode) {
            tweetContainer.remove();
          } else {
            // Make sure container is relatively positioned for overlay
            tweetContainer.style.position = "relative";
            tweetContainer.appendChild(createBlurOverlay(tweetContainer));
          }
          blockedCount++;
          console.log(
            `Handled Ghibli tweet (${
              deleteMode ? "deleted" : "blurred"
            }). Total blocked: ${blockedCount}`
          );
          chrome.storage.local.set({ blockedCount });
        } else {
          console.log("Could not find tweet container to handle");
        }
        break;
      }
    }
  } catch (error) {
    console.error("Error processing tweet:", error);
  }
}

// Create an observer to watch for new tweets
const observer = new MutationObserver((mutations) => {
  if (!isEnabled) {
    console.log("Observer triggered but blocking is disabled");
    return;
  }

  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tweets = node.querySelectorAll("article");
        tweets.forEach(processTweet);
      }
    }
  }
});

// Start observing the timeline
function observeTimeline() {
  const timeline = document.querySelector("main");
  console.log("Looking for timeline element:", timeline);

  if (timeline) {
    observer.observe(timeline, {
      childList: true,
      subtree: true,
    });
    console.log("No Ghibli: Started observing timeline successfully");
  } else {
    console.log("Timeline not found, retrying in 1 second...");
    setTimeout(observeTimeline, 1000);
  }
}

// Start the observation when the script loads
observeTimeline();
