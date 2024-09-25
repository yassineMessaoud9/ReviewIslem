import express from "express";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { checkSchema, matchedData, validationResult } from "express-validator";
import GetReviewsValidationSchema from "./validation/GetReviewsValidationSchema.mjs";
import ReplyReviewValidationSchema from "./validation/ReplyReviewValidationSchema.mjs";
import AuthenticateValidationSchema from "./validation/AuthenticateValidationSchema.mjs";

// Configrations
dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// "page.waitForTimeout()" alternative
async function waitFor(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start browser
let browser;
let page;
try {
    browser = await chromium.launch({
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
    page = await browser.newPage();
} catch (err) {
    console.log("Failed to open browser, ", err.errorMessage);
}

// Endpoints
app.post(
    "/authenticate",
    checkSchema(AuthenticateValidationSchema),
    async (req, res) => {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty())
            return res.status(400).send(validationErrors);

        const data = matchedData(req);

        try {
            await browser.close();
            browser = await chromium.launch({
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
            page = await browser.newPage();

            // Replace with the URL of the Google Places page
            const googlePlacesURL = "https://www.google.com/maps";

            // The actual interesting bit
            await page.goto(googlePlacesURL);

            // Authentication
            const loginButton = "a.gb_pd.gb_Ua.gb_gd";
            await page.waitForSelector(loginButton);
            await page.locator(loginButton).click();
            await page.waitForSelector("input[type='email']");
            await page.fill("input[type='email']", data.email);
            await page.locator(".TNTaPb button.VfPpkd-LgbsSe").click();
            await page.waitForSelector("input[type='password']");
            await page.fill("input[type='password']", data.password);
            await page.locator(".TNTaPb button.VfPpkd-LgbsSe").click();
            await waitFor(1000);
        } catch (err) {
            res.status(400).send({ error: err.errorMessage });
        }

        res.status(200).send({ msg: "Authenticated successfully!" });
    }
);

app.get(
    "/reviews",
    checkSchema(GetReviewsValidationSchema),
    async (req, res) => {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty())
            return res.status(400).send(validationErrors);

        const data = matchedData(req);

        try {
            // The actual interesting bit
            await page.goto(data.placeID);

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
                            user: review?.querySelector(".d4r55 span")
                                ?.textContent,
                            rating: review
                                ?.querySelector(".DU9Pgb .kvMYJc")
                                ?.getAttribute("aria-label"),
                            reviewText:
                                review?.querySelector(".MyEned span")
                                    ?.textContent,
                            date: review?.querySelector(".DU9Pgb .rsqaWe")
                                ?.textContent,
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
        } catch (err) {
            res.status(400).send({ error: err.errorMessage });
        }

        res.status(200).json(allReviews);
    }
);

app.post(
    "/review/reply",
    checkSchema(ReplyReviewValidationSchema),
    async (req, res) => {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty())
            return res.status(400).send(validationErrors);

        const data = matchedData(req);

        try {
            // The actual interesting bit
            await page.goto(data.placeID);

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
                            user: review?.querySelector(".d4r55 span")
                                ?.textContent,
                            rating: review
                                ?.querySelector(".DU9Pgb .kvMYJc")
                                ?.getAttribute("aria-label"),
                            reviewText:
                                review?.querySelector(".MyEned span")
                                    ?.textContent,
                            date: review?.querySelector(".DU9Pgb .rsqaWe")
                                ?.textContent,
                        });
                    });
                    return reviews;
                });

                // Check if all of reviews are rendered or not
                if (latestLength == reviews.length) {
                    if (matchedLength >= 1) break;
                    matchedLength++;
                } else {
                    matchedLength = 0;
                }
                latestLength = reviews.length;
            }

            // Reply on review
            await page
                .locator(
                    `.Upo0Ec button.GBkF3d[data-review-id="${data.reviewID}"]:first-child`
                )
                .click();
            const replyIframe = "iframe#guest-app-iframe";
            const iframeElement = await page.waitForSelector(replyIframe);
            const frame = await iframeElement.contentFrame();
            await frame.waitForSelector("textarea");
            await frame.fill("textarea", data.replyMessage);
            await frame
                .locator(
                    "div.FkJOzc.lgfhc.LW6Hp button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ"
                )
                .click();
        } catch (err) {
            res.status(400).send({ error: err.errorMessage });
        }

        res.status(200).json({ msg: "Replied successfully!" });
    }
);

// Server UP
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Go to http://localhost:${PORT}`);
});
