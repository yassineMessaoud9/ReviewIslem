import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";

// Configrations
dotenv.config();
puppeteer.use(StealthPlugin());

// "page.waitForTimeout()" alternative
async function waitFor(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run this command (windows): "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\localhost"

(async () => {
    console.time("time");
    // Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-gpu",
            "--enable-webgl",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-blink-features=AutomationControlled",
        ],
        // userDataDir: "C:/localhost", // Replace this path with your chrome profile directory
    }); // Set headless: true for no UI
    const page = await browser.newPage();

    // Set user-agent
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
        "accept-language": "en-US,en;q=0.9",
    });

    // Overwrite the `navigator.webdriver` property to avoid detection
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
            get: () => false,
        });
    });

    // Set user-agent
    // await page.setUserAgent(
    //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36"
    // );

    // Replace with the URL of the Google Places page
    const googlePlacesURL = `https://www.google.com/maps/place/${process.env.PLACE_ID}`;

    // Navigate to Google Places page
    await page.goto(googlePlacesURL, { waitUntil: "networkidle2" });

    // Get recent reviews
    const filterSelector =
        "div.TrU0dc.kdfrQc.NUqjXc button.g88MCb.S9kvJb[aria-label='ترتيب المراجعات']";
    await page.waitForSelector(filterSelector);
    await page.locator(filterSelector).click();

    const filterOption =
        "div.fontBodyLarge.yu5kgd.vij30.kA9KIf div[data-index='1']";
    await page.locator(filterOption).click();

    // Important variables
    let matchedLength = 0;
    let latestLength = 0;
    let allReviews = [];

    // Scrape reviews
    while (true) {
        const reviewsContainer = ".m6QErb.DxyBCb.kA9KIf";
        await page.evaluate((selector) => {
            const div = document.querySelector(selector);
            if (div) {
                div.scrollTop = div.scrollHeight; // Scroll to the bottom
            }
        }, reviewsContainer);

        // Wait for new content to load
        await waitFor(1000);

        const reviews = await page.evaluate(() => {
            let reviews = [];
            document.querySelectorAll(".jftiEf").forEach((review) => {
                reviews.push({
                    id: review?.getAttribute("data-review-id"),
                    user: review?.querySelector(".d4r55 span")?.textContent,
                    rating: review
                        ?.querySelector(".DU9Pgb .kvMYJc")
                        ?.getAttribute("aria-label"),
                    reviewText:
                        review?.querySelector(".MyEned span")?.textContent,
                    date: review?.querySelector(".DU9Pgb .rsqaWe")?.textContent,
                });
            });
            return reviews;
        });

        // Check if all of reviews are rendered or not
        if (latestLength == reviews.length) {
            if (matchedLength >= 1) {
                allReviews = reviews;
                break;
            }
            matchedLength++;
        } else {
            matchedLength = 0;
        }
        latestLength = reviews.length;
    }

    // Print all of reviews
    console.log(allReviews);

    // Reply on review (You can comment this section if you do not want to reply on a review)
    // const reviewID = allReviews[0].id; // Random review id
    // const replyMessage = "Thanks for your review.";
    // await page.locator(`button.GBkF3d[data-review-id="${reviewID}"]`).click();
    // const replyIframe = "iframe#guest-app-iframe";
    // const iframeElement = await page.waitForSelector(replyIframe);
    // const frame = await iframeElement.contentFrame();
    // await frame.waitForSelector("textarea");
    // await frame.type("textarea", replyMessage);
    // await frame
    //     .locator(
    //         "div.FkJOzc.lgfhc.LW6Hp button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ"
    //     )
    //     .click();

    // Close the browser
    await browser.close();
    console.timeEnd("time");
})();
