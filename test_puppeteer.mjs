import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Go to admin settings page
        // Wait, it requires authentication? Let's check if the admin page is protected.
        // Yes, likely.
        console.log("Need auth...");
        await browser.close();
    } catch(e) {
        console.error(e);
    }
})();
