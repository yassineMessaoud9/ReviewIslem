import { chromium } from "playwright";
import dotenv from "dotenv";

// Configrations
dotenv.config();

// "page.waitForTimeout()" alternative
async function waitFor(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    console.time("time");
    // Setup
    const browser = await chromium.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-gpu",
            "--enable-webgl",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-blink-features=AutomationControlled",
        ],
    });
    const page = await browser.newPage();

    // Replace with the URL of the Google Places page
    const googlePlacesURL = `https://www.google.com/maps/place/${process.env.PLACE_ID}`;

    // The actual interesting bit
    await page.goto(googlePlacesURL);

    // Authentication
    const loginButton = "a.gb_pd.gb_Ua.gb_gd";
    await page.waitForSelector(loginButton);
    await page.locator(loginButton).click();
    await page.waitForSelector("input[type='email']");
    await page.fill("input[type='email']", process.env.EMAIL);
    await page.locator(".TNTaPb button.VfPpkd-LgbsSe").click();
    await page.waitForSelector("input[type='password']");
    await page.fill("input[type='password']", process.env.PASSWORD);
    await page.locator(".TNTaPb button.VfPpkd-LgbsSe").click();

    // Get recent reviews
    const filterSelector =
        "div.TrU0dc.kdfrQc.NUqjXc button.g88MCb.S9kvJb[aria-label='ترتيب المراجعات']";
    await page.waitForSelector(filterSelector);
    await waitFor(100);
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
    const reviewID = allReviews[0].id; // Random review id
    console.log(reviewID);
    const replyMessage = "Thanks for your review.";
    await page
        .locator(
            `.Upo0Ec button.GBkF3d[data-review-id="${reviewID}"]:nth-of-type(1)`
        )
        .click();
    const replyIframe = "iframe#guest-app-iframe";
    const iframeElement = await page.waitForSelector(replyIframe);
    const frame = await iframeElement.contentFrame();
    await frame.waitForSelector("textarea");
    await frame.fill("textarea", replyMessage);
    await frame
        .locator(
            "div.FkJOzc.lgfhc.LW6Hp button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ"
        )
        .click();

    // Teardown
    await browser.close();
    console.timeEnd("time");
})();
