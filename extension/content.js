// Global state
let isEnabled = true;
let blockedCount = 0;

// Load initial state
chrome.storage.local.get(["isEnabled", "blockedCount"], (result) => {
  isEnabled = result.isEnabled !== false;
  blockedCount = result.blockedCount || 0;
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleBlocking") {
    isEnabled = message.isEnabled;
    console.log(`Blocking toggled: isEnabled = ${isEnabled}`);
  }
});

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
          tweetContainer.remove();
          blockedCount++;
          console.log(`Removed Ghibli tweet. Total blocked: ${blockedCount}`);
          chrome.storage.local.set({ blockedCount });
        } else {
          console.log("Could not find tweet container to remove");
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
